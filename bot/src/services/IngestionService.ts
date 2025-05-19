// services/IngestionService.ts
import { PrismaClient, Prisma } from "@prisma/client";
import { ZkillClient } from "../lib/api/ZkillClient";
import { MapClient } from "../lib/api/MapClient";
import { RedisCache } from "../lib/cache/RedisCache";
import { IngestionConfig } from "../types/ingestion";
import { logger } from "../lib/logger";
import { ESIService } from "./ESIService";

// ——— Prisma client singleton ———
const prisma = new PrismaClient();

// Log every SQL query in development
if (process.env.NODE_ENV === "development") {
  // cast to any so TS accepts the string event name
  (prisma as any).$on("query", (e: Prisma.QueryEvent) => {
    logger.debug(`SQL ▶ ${e.query}`);
    logger.debug(`⏱  ${e.duration}ms`);
  });
}

// ——— Helpers ———
/** Safely coerce numbers/strings to BigInt, or return null */
const toBigInt = (val?: number | string | null): bigint | null =>
  val == null ? null : BigInt(typeof val === "string" ? val : Math.trunc(val));

// ——— Ingestion Service ———
export class IngestionService {
  /** Exposed for external access (e.g. in server.ts) */
  public readonly prisma = prisma;
  private readonly zkill: ZkillClient;
  private readonly map: MapClient;
  private readonly cache: RedisCache;
  private readonly esiService: ESIService;
  private readonly cfg: {
    zkillApiUrl: string;
    mapApiUrl: string;
    mapApiKey: string;
    redisUrl: string;
    cacheTtl: number;
    batchSize: number;
    backoffMs: number;
    maxRetries: number;
  };

  constructor(config?: Partial<IngestionConfig>) {
    // Fill in defaults so everything is defined
    this.cfg = {
      zkillApiUrl: config?.zkillApiUrl || "https://zkillboard.com/api",
      mapApiUrl: config?.mapApiUrl || "",
      mapApiKey: config?.mapApiKey || "",
      redisUrl: config?.redisUrl || "redis://localhost:6379",
      cacheTtl: config?.cacheTtl || 300,
      batchSize: config?.batchSize || 100,
      backoffMs: config?.backoffMs || 1000,
      maxRetries: config?.maxRetries || 3,
    };

    this.zkill = new ZkillClient(this.cfg.zkillApiUrl);
    this.map = new MapClient(this.cfg.mapApiUrl, this.cfg.mapApiKey);
    this.cache = new RedisCache(this.cfg.redisUrl, this.cfg.cacheTtl);
    this.esiService = new ESIService();
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries = 3,
    retryDelay = 5000,
    timeout = 30000 // 30 second default timeout
  ): Promise<T | undefined> {
    let retryCount = 0;
    while (retryCount < maxRetries) {
      try {
        logger.info(
          `${operationName} (attempt ${retryCount + 1}/${maxRetries})`
        );
        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Operation timed out after ${timeout}ms`)),
            timeout
          );
        });

        // Race the operation against the timeout
        const result = await Promise.race([operation(), timeoutPromise]);
        return result;
      } catch (e: any) {
        retryCount++;

        // Format a simple human-readable error message
        const status = e.response?.status;
        const url = e.config?.url;
        const errorMsg = e.message || "Unknown error";

        if (retryCount >= maxRetries) {
          logger.error(
            `${operationName} failed after ${maxRetries} attempts: ${errorMsg}${
              status ? ` (${status})` : ""
            }${url ? ` - ${url}` : ""}`
          );
          return undefined;
        }

        logger.warn(
          `${operationName} failed (attempt ${retryCount}/${maxRetries}): ${errorMsg}${
            status ? ` (${status})` : ""
          }${url ? ` - ${url}` : ""}. Retrying in ${retryDelay / 1000}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
    return undefined;
  }

  /**
   * Ingests a single killmail:
   * - Skips if already processed
   * - Fetches zKillboard + ESI
   * - Creates KillFact, KillVictim, KillAttacker, LossFact
   */
  public async ingestKillmail(killId: number): Promise<{
    success: boolean;
    skipped?: boolean;
    existing?: boolean;
    timestamp?: string;
    age?: number;
    error?: string;
  }> {
    try {
      // 1) Skip if already in DB - killmails are immutable
      const exists = await this.prisma.killFact.findUnique({
        where: { killmail_id: toBigInt(killId)! },
      });
      if (exists) {
        logger.debug(`Skipping killmail ${killId}, already processed`);
        return { success: false, existing: true, skipped: true };
      }

      // 2) Fetch from zKillboard with retry (15s timeout for zKill)
      const zk = await this.retryOperation(
        () => this.zkill.getKillmail(killId),
        `Fetching zKill data for killmail ${killId}`,
        3, // maxRetries
        5000, // retryDelay
        15000 // timeout
      );
      if (!zk) {
        logger.warn(`No zKill data for killmail ${killId}`);
        return { success: false, skipped: true };
      }

      // 3) Fetch from ESI with caching and retry (30s timeout for ESI)
      const esi = await this.retryOperation(
        () => this.esiService.getKillmail(zk.killmail_id, zk.zkb.hash),
        `Fetching ESI data for killmail ${killId}`,
        3, // maxRetries
        5000, // retryDelay
        30000 // timeout
      );
      if (!esi?.victim) {
        logger.warn(`Invalid ESI data for killmail ${killId}`);
        return { success: false, skipped: true };
      }

      // 4) Shape victim + attackers
      const victim = {
        character_id: toBigInt(esi.victim.character_id),
        corporation_id: toBigInt(esi.victim.corporation_id),
        alliance_id: toBigInt(esi.victim.alliance_id),
        ship_type_id: esi.victim.ship_type_id,
        damage_taken: esi.victim.damage_taken,
      };
      const attackers = (esi.attackers as any[]).map((a: any) => ({
        character_id: toBigInt(a.character_id),
        corporation_id: toBigInt(a.corporation_id),
        alliance_id: toBigInt(a.alliance_id),
        damage_done: a.damage_done,
        final_blow: a.final_blow,
        security_status: a.security_status,
        ship_type_id: a.ship_type_id,
        weapon_type_id: a.weapon_type_id,
      }));

      // 5) Determine which characters are tracked
      const allIds = [
        victim.character_id,
        ...attackers.map((att) => att.character_id),
      ]
        .filter((x): x is bigint => x != null)
        .map((b) => b.toString());

      const tracked = await this.prisma.character.findMany({
        where: { eveId: { in: allIds } },
      });
      if (tracked.length === 0) {
        logger.debug(`No tracked characters in killmail ${killId}`);
        return { success: false, skipped: true };
      }
      const trackedSet = new Set(tracked.map((c) => c.eveId));

      // 6) Persist in one transaction
      await this.prisma.$transaction(async (tx) => {
        // a) KillFact
        const mainChar =
          attackers.find(
            (a) =>
              a.character_id != null &&
              trackedSet.has(a.character_id.toString())
          )?.character_id ??
          victim.character_id ??
          BigInt(0);

        await tx.killFact.create({
          data: {
            killmail_id: BigInt(killId),
            kill_time: new Date(esi.killmail_time),
            system_id: esi.solar_system_id,
            total_value: BigInt(Math.round(zk.zkb.totalValue)),
            points: zk.zkb.points,
            character_id: mainChar,
            npc: false,
            solo: attackers.length === 1,
            awox: false,
            ship_type_id: esi.victim.ship_type_id,
            labels: zk.zkb.labels ?? [],
          },
        });

        // b) KillVictim
        await tx.killVictim.create({
          data: { killmail_id: BigInt(killId), ...victim },
        });

        // c) KillAttackers (in parallel)
        await Promise.all(
          attackers.map((att: any) =>
            tx.killAttacker.create({
              data: { killmail_id: BigInt(killId), ...att },
            })
          )
        );
      });

      const timestamp = esi.killmail_time;
      const age = Math.floor(
        (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24)
      );

      return { success: true, timestamp, age };
    } catch (err: any) {
      logger.error(`ingestKillmail(${killId}) error: ${err.message || err}`);
      return { success: false, skipped: true, error: err.message };
    }
  }

  /**
   * Ingest map activity for a slug over `days` days.
   */
  public async ingestMapActivity(slug: string, days = 7): Promise<void> {
    try {
      const cacheKey = `map:${slug}:${days}`;
      const resp = await this.cache.getOrSet(cacheKey, () =>
        this.map.getCharacterActivity(slug, days)
      );
      const data = (resp?.data as any[]) ?? [];
      logger.info(`Fetched ${data.length} map records for ${slug}`);

      await Promise.all(
        data.map((act: any) => {
          if (!act.character?.eve_id) return Promise.resolve();
          const charId = BigInt(act.character.eve_id);
          const ts = new Date(act.timestamp);
          return this.prisma.mapActivity.upsert({
            where: {
              characterId_timestamp: {
                characterId: charId,
                timestamp: ts,
              },
            },
            update: {
              signatures: act.signatures,
              connections: act.connections,
              passages: act.passages,
              allianceId: act.character.alliance_id,
              corporationId: act.character.corporation_id,
            },
            create: {
              characterId: charId,
              timestamp: ts,
              signatures: act.signatures,
              connections: act.connections,
              passages: act.passages,
              allianceId: act.character.alliance_id,
              corporationId: act.character.corporation_id,
            },
          });
        })
      );
    } catch (err: any) {
      logger.error(`ingestMapActivity error: ${err.message || err}`);
      throw err;
    }
  }

  /**
   * Sync map activity data using a complete refresh approach
   *
   * @param slug Map slug name
   */
  public async syncRecentMapActivity(slug: string): Promise<void> {
    try {
      // Simplify - just replace all map activity data with fresh data
      logger.info(`Replacing all map activity data for ${slug}`);
      await this.refreshMapActivityData(slug, 7);
    } catch (err: any) {
      logger.error(`syncRecentMapActivity error: ${err.message || err}`);
      throw err;
    }
  }

  /**
   * Completely refresh map activity data by wiping and replacing
   * with fresh data from the last N days
   *
   * @param slug Map slug to fetch data for
   * @param days Number of days of data to fetch (default: 7)
   */
  public async refreshMapActivityData(slug: string, days = 7): Promise<void> {
    try {
      // Calculate date range we're trying to fetch
      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - days);

      logger.info(
        `Refreshing all map activity data for ${slug} (${days} days: ${startDate.toISOString()} to ${today.toISOString()})`
      );

      // First, get a list of characters we want to track
      const characters = await this.prisma.character.findMany({
        where: {
          characterGroupId: { not: null }, // Only track characters in groups
        },
        select: {
          eveId: true,
          name: true,
        },
      });

      // Get current count
      const initialCount = await this.prisma.mapActivity.count();
      logger.info(
        `Found ${characters.length} characters to track, current DB has ${initialCount} activity records`
      );

      // Get the activity data from the map API
      logger.info(
        `Calling map API to get ${days} days of activity data for ${slug}`
      );
      const resp = await this.map.getCharacterActivity(slug, days);
      const data = (resp?.data as any[]) ?? [];
      logger.info(
        `Fetched ${data.length} map activity records from API for the specified ${days} days`
      );

      // Log date range of the data we received
      if (data.length > 0) {
        try {
          const timestamps = data.map((item: any) => new Date(item.timestamp));
          const oldestDate = new Date(
            Math.min(...timestamps.map((d: Date) => d.getTime()))
          );
          const newestDate = new Date(
            Math.max(...timestamps.map((d: Date) => d.getTime()))
          );
          const actualDays = Math.round(
            (newestDate.getTime() - oldestDate.getTime()) /
              (1000 * 60 * 60 * 24)
          );
          logger.info(
            `Actual date range in response: ${oldestDate.toISOString()} to ${newestDate.toISOString()} (spans ~${actualDays} days)`
          );
        } catch (e) {
          logger.error(`Error analyzing date range: ${e}`);
        }
      }

      if (data.length === 0) {
        logger.warn("No map activity data received from API, skipping refresh");
        return;
      }

      // Filter to only include data for tracked characters
      const characterIds = new Set(characters.map((c) => c.eveId));
      const filteredData = data.filter((act) => {
        if (!act.character?.eve_id) return false;
        return characterIds.has(act.character.eve_id.toString());
      });

      logger.info(
        `Filtered to ${filteredData.length} relevant map activities for tracked characters`
      );

      if (filteredData.length === 0) {
        logger.warn(
          "No relevant map activity data for tracked characters, skipping refresh"
        );
        return;
      }

      // Start transaction
      await this.prisma.$transaction(async (tx) => {
        // Delete ALL existing data from the table, regardless of date
        const deleted = await tx.mapActivity.deleteMany({});

        logger.info(
          `Deleted all ${deleted.count} existing map activity records from the database`
        );

        // Insert all new data in bulk
        let insertedCount = 0;
        for (const act of filteredData) {
          if (!act.character?.eve_id) continue;

          const charId = BigInt(act.character.eve_id);
          const ts = new Date(act.timestamp);

          await tx.mapActivity.create({
            data: {
              characterId: charId,
              timestamp: ts,
              signatures: act.signatures,
              connections: act.connections,
              passages: act.passages,
              allianceId: act.character.alliance_id,
              corporationId: act.character.corporation_id,
            },
          });
          insertedCount++;
        }
        logger.info(`Inserted ${insertedCount} new map activity records`);
      });

      // Get new count
      const finalCount = await this.prisma.mapActivity.count();
      logger.info(
        `Map activity refresh complete: Now have ${finalCount} total activity records (was ${initialCount})`
      );
    } catch (err: any) {
      logger.error(`refreshMapActivityData error: ${err.message || err}`);
      throw err;
    }
  }

  /**
   * Syncs user characters from a map source
   */
  public async syncUserCharacters(slug: string): Promise<void> {
    logger.info(`Syncing user characters from map ${slug}`);
    const userData = await this.map.getUserCharacters(slug);
    const users = userData.data || [];
    logger.info(`Parsed ${users.length} user entries`);

    // Count total characters
    const totalChars = users.reduce(
      (sum: number, user: any) => sum + (user.characters?.length || 0),
      0
    );
    logger.info(`Total characters: ${totalChars}`);

    let processed = 0;
    let skipped = 0;
    let groupsCreated = 0;
    let groupsUpdated = 0;
    let groupsDeleted = 0;

    logger.info(`Processing ${users.length} users from map API`);

    // Get all existing groups for this slug
    const existingGroups = await this.prisma.characterGroup.findMany({
      where: {
        slug: {
          startsWith: `${slug}_`,
        },
      },
      include: {
        characters: true,
      },
    });

    // Create maps for efficient group lookup
    const mainCharToGroup = new Map(
      existingGroups
        .filter((g) => g.mainCharacterId)
        .map((g) => [g.mainCharacterId, g])
    );
    const slugToGroup = new Map(existingGroups.map((g) => [g.slug, g]));

    // PHASE 1: Create all characters first without assigning to groups
    for (const user of users) {
      const chars = user.characters || [];
      if (chars.length === 0) continue;

      // Find the main character ID (if specified)
      const mainId = user.main_character_eve_id?.toString();

      logger.info(
        `User ${slug}: main=${mainId ?? "none"}, count=${chars.length}`
      );

      // Process each character
      for (const c of chars) {
        processed++;
        const charData = {
          eveId: c.eve_id.toString(),
          name: c.name,
          allianceId: c.alliance_id,
          allianceTicker: c.alliance_ticker,
          corporationId: c.corporation_id,
          corporationTicker: c.corporation_ticker,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          // Create character without a group association yet
          await this.prisma.character.upsert({
            where: { eveId: charData.eveId },
            update: {
              name: charData.name,
              allianceId: charData.allianceId,
              allianceTicker: charData.allianceTicker,
              corporationId: charData.corporationId,
              corporationTicker: charData.corporationTicker,
            },
            create: {
              ...charData,
            },
          });
        } catch (e: any) {
          skipped++;
          logger.error(
            { error: e.message || e, char: charData },
            `Failed to upsert character ${c.eve_id}`
          );
        }
      }
    }

    // PHASE 2: Update or create character groups and link characters
    for (const user of users) {
      const chars = user.characters || [];
      if (chars.length === 0) continue;

      // Find the main character ID (if specified)
      const mainId = user.main_character_eve_id?.toString();

      // Create a unique group slug for this user
      const grpSlug = `${slug}_${mainId ?? chars[0].eve_id}`;

      // Find existing group by main character ID or slug
      let group = mainId
        ? mainCharToGroup.get(mainId)
        : slugToGroup.get(grpSlug);

      if (!group) {
        logger.info(`Creating new character group with slug ${grpSlug}`);
        try {
          const newGroup = await this.prisma.characterGroup.upsert({
            where: { slug: grpSlug },
            update: {
              mainCharacterId: mainId,
            },
            create: {
              slug: grpSlug,
              mainCharacterId: mainId,
            },
            include: {
              characters: true,
            },
          });
          group = newGroup;
          groupsCreated++;

          // Log if this is a group without a main character
          if (!mainId) {
            logger.warn(
              `Group ${grpSlug} created without main character. First character: ${chars[0].name} (${chars[0].eve_id})`
            );
          }
        } catch (e: any) {
          logger.error(
            { error: e.message || e },
            `Failed to create/update group with slug ${grpSlug}`
          );
          // Skip this group and continue with the next one
          continue;
        }
      } else {
        // Update existing group if needed
        if (group.slug !== grpSlug || group.mainCharacterId !== mainId) {
          logger.info(`Updating group ${group.id} with new slug ${grpSlug}`);
          const updatedGroup = await this.prisma.characterGroup.update({
            where: { id: group.id },
            data: {
              slug: grpSlug,
              mainCharacterId: mainId,
            },
            include: {
              characters: true,
            },
          });
          group = updatedGroup;
          groupsUpdated++;

          // Log if this group is being updated to have no main character
          if (!mainId) {
            logger.warn(
              `Group ${grpSlug} updated to have no main character. First character: ${chars[0].name} (${chars[0].eve_id})`
            );
          }
        }
      }

      // Now link characters to the group
      for (const c of chars) {
        try {
          await this.prisma.character.update({
            where: { eveId: c.eve_id.toString() },
            data: { characterGroupId: group.id },
          });
        } catch (e: any) {
          logger.error(
            { error: e.message || e },
            `Failed to link character ${c.eve_id} to group ${group.id}`
          );
        }
      }
    }

    // PHASE 3: Clean up empty groups
    for (const group of existingGroups) {
      const charCount = await this.prisma.character.count({
        where: { characterGroupId: group.id },
      });

      if (charCount === 0) {
        logger.info(`Deleting empty group ${group.id} (${group.slug})`);
        await this.prisma.characterGroup.delete({
          where: { id: group.id },
        });
        groupsDeleted++;
      }
    }

    // Log summary of groups without main characters
    const groupsWithoutMain = await this.prisma.characterGroup.findMany({
      where: {
        mainCharacterId: null,
        characters: {
          some: {}, // Has at least one character
        },
      },
      include: {
        characters: {
          orderBy: {
            name: "asc",
          },
          take: 1, // Get first character
        },
      },
    });

    if (groupsWithoutMain.length > 0) {
      logger.warn(
        `Found ${groupsWithoutMain.length} groups without main characters:`
      );
      for (const group of groupsWithoutMain) {
        const firstChar = group.characters[0];
        logger.warn(
          `- Group ${group.slug}: First character ${firstChar.name} (${firstChar.eveId})`
        );
      }
    }

    const totalCharsAfterSync = await this.prisma.character.count();
    const totalGroups = await this.prisma.characterGroup.count();
    logger.info(
      `Character sync complete: processed=${processed}, skipped=${skipped}, ` +
        `chars=${totalCharsAfterSync}, groups=${totalGroups}, ` +
        `created=${groupsCreated}, updated=${groupsUpdated}, deleted=${groupsDeleted}`
    );
  }

  /** Safely parse a date string, returning null if invalid */
  private safeParseDate(dateStr: string | undefined | null): Date | null {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch (e) {
      return null;
    }
  }

  private async backfillRecords(
    characterId: number,
    type: "kills" | "losses",
    maxAgeInDays = 30
  ): Promise<void> {
    const char = await this.prisma.character.findUnique({
      where: { eveId: characterId.toString() },
    });
    if (!char) {
      logger.warn(
        `Character ${characterId} not in DB, skipping ${type} backfill.`
      );
      return;
    }

    // Check if we should run the backfill based on the last backfill time
    if (char.lastBackfillAt) {
      const hrs =
        (Date.now() - char.lastBackfillAt.getTime()) / (1000 * 60 * 60);
      if (hrs < 1) {
        logger.info(
          `Backfill for ${characterId} skipped; ran ${hrs.toFixed(2)}h ago`
        );
        return;
      }
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeInDays);

    logger.info(
      `Backfilling ${type} for ${
        char.name
      } (${characterId}) since ${cutoff.toISOString()}`
    );

    // Get current count for this character
    const currentCount =
      type === "kills"
        ? await this.prisma.killFact.count({
            where: {
              OR: [
                { character_id: BigInt(characterId) },
                {
                  attackers: {
                    some: {
                      character_id: BigInt(characterId),
                    },
                  },
                },
              ],
            },
          })
        : await this.prisma.lossFact.count({
            where: {
              character_id: BigInt(characterId),
            },
          });

    logger.info(
      `Character ${char.name} has ${currentCount} ${type} in database before backfill`
    );

    // Get or create checkpoint
    const checkpoint = await this.prisma.ingestionCheckpoint.upsert({
      where: { streamName: `${type}:${characterId}` },
      update: {},
      create: {
        streamName: `${type}:${characterId}`,
        lastSeenId: BigInt(0),
        lastSeenTime: new Date(),
      },
    });

    let page = 1;
    let hasMore = true;
    let successfulIngestCount = 0;
    let skippedCount = 0;
    let tooOldCount = 0;
    let consecutiveEmptyPages = 0;
    let totalPagesProcessed = 0;
    const MAX_CONSECUTIVE_EMPTY = 5; // Increased from 3 to 5
    const MAX_PAGES = 20; // Increased from 5 to 20
    const MAX_RECORDS = 500; // Increased from 100 to 500

    // Track the oldest record we've seen to ensure we're not missing anything
    let oldestRecordTime: Date | null = null;
    let newestRecordTime: Date | null = null;

    while (hasMore) {
      try {
        logger.info(`Fetching ${type} for ${char.name}, page ${page}`);

        // Fetch records based on type
        const records = await this.retryOperation(
          () =>
            type === "kills"
              ? this.zkill.getCharacterKills(characterId, page)
              : this.zkill.getCharacterLosses(characterId, page),
          `Fetching ${type} for character ${characterId} at page ${page}`,
          3, // maxRetries
          5000, // retryDelay
          type === "kills" ? 15000 : 20000 // timeout
        );

        if (!records.length) {
          consecutiveEmptyPages++;
          logger.info(
            `Empty page ${page} received (consecutive: ${consecutiveEmptyPages}/${MAX_CONSECUTIVE_EMPTY})`
          );
          if (consecutiveEmptyPages >= MAX_CONSECUTIVE_EMPTY) {
            logger.info(
              `No ${type} found for ${char.name} after ${consecutiveEmptyPages} empty pages, stopping`
            );
            hasMore = false;
            break;
          }
          page++;
          continue;
        }
        consecutiveEmptyPages = 0;
        totalPagesProcessed++;

        // Update time range tracking
        const pageTimes = records
          .map((r: { killmail_time: string }) =>
            this.safeParseDate(r.killmail_time)
          )
          .filter((d: Date | null): d is Date => d !== null);

        if (pageTimes.length === 0) {
          logger.warn(
            `No valid timestamps found in page ${page}, skipping time range calculation`
          );
          continue;
        }

        const pageOldest = new Date(
          Math.min(...pageTimes.map((d: Date) => d.getTime()))
        );
        const pageNewest = new Date(
          Math.max(...pageTimes.map((d: Date) => d.getTime()))
        );

        if (!oldestRecordTime || pageOldest < oldestRecordTime) {
          oldestRecordTime = pageOldest;
        }
        if (!newestRecordTime || pageNewest > newestRecordTime) {
          newestRecordTime = pageNewest;
        }

        logger.info(
          `Processing ${records.length} ${type} for ${char.name} (page ${page}) - ` +
            `Time range: ${pageOldest.toISOString()} to ${pageNewest.toISOString()}`
        );

        let foundTooOld = false;
        let lastProcessedId = checkpoint.lastSeenId;
        let pageProcessedCount = 0;
        let pageSkippedCount = 0;

        // Process each record
        for (const record of records) {
          try {
            const recordTime = this.safeParseDate(record.killmail_time);
            if (!recordTime) {
              logger.warn(
                `Invalid timestamp for ${type} ${record.killmail_id}, skipping`
              );
              pageSkippedCount++;
              skippedCount++;
              continue;
            }

            const recordId = BigInt(record.killmail_id);

            // Skip if we've already processed this record
            if (recordId <= checkpoint.lastSeenId) {
              pageSkippedCount++;
              skippedCount++;
              continue;
            }

            // Skip if it's too old
            if (recordTime < cutoff) {
              tooOldCount++;
              foundTooOld = true;
              continue;
            }

            // Process based on type
            if (type === "kills") {
              const result = await this.ingestKillmail(record.killmail_id);
              if (result.success) {
                successfulIngestCount++;
                pageProcessedCount++;
                lastProcessedId = recordId;
              } else {
                pageSkippedCount++;
                skippedCount++;
              }
            } else {
              // Check if loss already exists
              const existing = await this.prisma.lossFact.findUnique({
                where: { killmail_id: recordId },
              });
              if (existing) {
                logger.debug(`Skipping loss ${recordId}, already processed`);
                pageSkippedCount++;
                skippedCount++;
                continue;
              }

              // Create the loss record
              await this.prisma.lossFact.create({
                data: {
                  killmail_id: recordId,
                  character_id: BigInt(characterId),
                  kill_time: recordTime,
                  ship_type_id: record.victim?.ship_type_id ?? 0,
                  system_id: record.solar_system_id ?? 0,
                  total_value: BigInt(Math.round(record.zkb?.totalValue ?? 0)),
                  attacker_count: record.attackers?.length ?? 0,
                  labels: record.zkb?.labels ?? [],
                },
              });

              successfulIngestCount++;
              pageProcessedCount++;
              lastProcessedId = recordId;
            }
          } catch (error) {
            logger.error(
              `Error processing ${type} ${record.killmail_id} for ${char.name}:`,
              error
            );
            skippedCount++;
          }
        }

        logger.info(
          `Page ${page} complete - Processed: ${pageProcessedCount}, Skipped: ${pageSkippedCount}, ` +
            `Total processed: ${successfulIngestCount}, Total skipped: ${skippedCount}`
        );

        // Update checkpoint with the last processed ID
        if (lastProcessedId > checkpoint.lastSeenId) {
          await this.prisma.ingestionCheckpoint.update({
            where: { streamName: `${type}:${characterId}` },
            data: {
              lastSeenId: lastProcessedId,
              lastSeenTime: new Date(),
            },
          });
          logger.info(`Updated checkpoint to ID ${lastProcessedId}`);
        }

        // If we found a record that's too old, stop after this page
        if (foundTooOld) {
          logger.info(
            `Found ${type} older than cutoff date (${cutoff.toISOString()}), stopping backfill`
          );
          hasMore = false;
        } else {
          // Move to next page
          page++;
        }

        // If we've reached max pages or records, stop to avoid overloading
        if (page > MAX_PAGES || successfulIngestCount > MAX_RECORDS) {
          logger.info(
            `Stopping backfill for ${char.name} after ${totalPagesProcessed} pages ` +
              `(${successfulIngestCount} new ${type}, max ${MAX_RECORDS} records)`
          );
          hasMore = false;
        }
      } catch (error) {
        logger.error(
          `Error fetching ${type} for ${char.name} at page ${page}:`,
          error
        );
        hasMore = false;
      }
    }

    // Update the backfill timestamp
    await this.prisma.character.update({
      where: { eveId: characterId.toString() },
      data: { lastBackfillAt: new Date() },
    });

    // Get the new count
    const newCount =
      type === "kills"
        ? await this.prisma.killFact.count({
            where: {
              OR: [
                { character_id: BigInt(characterId) },
                {
                  attackers: {
                    some: {
                      character_id: BigInt(characterId),
                    },
                  },
                },
              ],
            },
          })
        : await this.prisma.lossFact.count({
            where: {
              character_id: BigInt(characterId),
            },
          });

    // Log detailed summary
    logger.info(
      `Backfill for ${char.name} complete:\n` +
        `- Total pages processed: ${totalPagesProcessed}\n` +
        `- New ${type} ingested: ${successfulIngestCount}\n` +
        `- Skipped: ${skippedCount}\n` +
        `- Too old: ${tooOldCount}\n` +
        `- Time range: ${oldestRecordTime?.toISOString() ?? "N/A"} to ${
          newestRecordTime?.toISOString() ?? "N/A"
        }\n` +
        `- Database count: ${newCount} (${newCount - currentCount} new)`
    );
  }

  /**
   * Backfills kills page-by-page for a character.
   */
  public async backfillKills(
    characterId: number,
    maxAgeInDays = 30
  ): Promise<void> {
    await this.backfillRecords(characterId, "kills", maxAgeInDays);
  }

  /**
   * Backfills losses via zKillboard API + Prisma upserts.
   */
  public async backfillLosses(
    characterId: number,
    maxAgeDays = 30
  ): Promise<void> {
    await this.backfillRecords(characterId, "losses", maxAgeDays);
  }

  /** Cleanly close cache & Prisma */
  public async close(): Promise<void> {
    await this.cache.close();
    await this.prisma.$disconnect();
  }
}
