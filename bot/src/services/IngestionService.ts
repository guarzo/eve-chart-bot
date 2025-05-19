// services/IngestionService.ts
import { PrismaClient, Prisma } from "@prisma/client";
import { ZkillClient } from "../lib/api/ZkillClient";
import { MapClient } from "../lib/api/MapClient";
import { RedisCache } from "../lib/cache/RedisCache";
import { IngestionConfig } from "../types/ingestion";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";
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
      // 1) Skip if already in DB
      const exists = await this.prisma.killFact.findUnique({
        where: { killmail_id: toBigInt(killId)! },
      });
      if (exists) {
        logger.debug(`Skipping killmail ${killId}, already processed`);
        return { success: false, existing: true, skipped: true };
      }

      // 2) Fetch from zKillboard
      const zk = await this.zkill.getKillmail(killId);
      if (!zk) {
        logger.warn(`No zKill data for killmail ${killId}`);
        return { success: false, skipped: true };
      }

      // 3) Fetch from ESI with caching
      const esi = await this.esiService.getKillmail(
        zk.killmail_id,
        zk.zkb.hash
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

        await tx.killFact.upsert({
          where: {
            killmail_id: BigInt(killId),
          },
          update: {
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
          create: {
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

        // IMPORTANT: Commented out loss creation to avoid double-counting
        // Losses should be handled exclusively through the backfillLosses method
        /*
        // d) LossFact if victim tracked
        if (
          victim.character_id != null &&
          trackedSet.has(victim.character_id.toString())
        ) {
          await tx.lossFact.upsert({
            where: { killmail_id: BigInt(killId) },
            update: {},
            create: {
              killmail_id: BigInt(killId),
              character_id: victim.character_id,
              kill_time: new Date(esi.killmail_time),
              ship_type_id: victim.ship_type_id,
              system_id: esi.solar_system_id,
              total_value: BigInt(Math.round(zk.zkb.totalValue)),
              attacker_count: attackers.length,
              labels: zk.zkb.labels ?? [],
            },
          });
        }
        */
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

    // Create a map of main character IDs to groups
    const mainCharToGroup = new Map(
      existingGroups.map((g) => [g.mainCharacterId, g])
    );

    // PHASE 1: Create all characters first without assigning to groups
    for (const user of users) {
      const chars = user.characters || [];
      if (chars.length === 0) continue;

      // Find the main character ID (if specified)
      const mainId = user.main_character_eve_id;

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
      const grpSlug = `${slug}_${mainId ?? uuidv4()}`;

      // Find existing group by main character ID or create new one
      let group = mainId ? mainCharToGroup.get(mainId) : null;

      if (!group) {
        logger.info(`Creating new character group with slug ${grpSlug}`);
        const newGroup = await this.prisma.characterGroup.create({
          data: {
            slug: grpSlug,
            mainCharacterId: mainId,
          },
          include: {
            characters: true,
          },
        });
        group = newGroup;
        groupsCreated++;
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

    const totalCharsAfterSync = await this.prisma.character.count();
    const totalGroups = await this.prisma.characterGroup.count();
    logger.info(
      `Character sync complete: processed=${processed}, skipped=${skipped}, ` +
        `chars=${totalCharsAfterSync}, groups=${totalGroups}, ` +
        `created=${groupsCreated}, updated=${groupsUpdated}, deleted=${groupsDeleted}`
    );
  }

  /**
   * Backfills kills page-by-page for a character.
   */
  public async backfillKills(
    characterId: number,
    maxAgeInDays = 30
  ): Promise<void> {
    const char = await this.prisma.character.findUnique({
      where: { eveId: characterId.toString() },
    });
    if (!char) {
      logger.warn(`Character ${characterId} not in DB, skipping backfill.`);
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
      `Backfilling kills for ${
        char.name
      } (${characterId}) since ${cutoff.toISOString()}`
    );

    // Get current kill count for this character
    const currentKillCount = await this.prisma.killFact.count({
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
    });

    logger.info(
      `Character ${char.name} has ${currentKillCount} kills in database before backfill`
    );

    // Get or create checkpoint
    const checkpoint = await this.prisma.ingestionCheckpoint.upsert({
      where: { streamName: `kills:${characterId}` },
      update: {},
      create: {
        streamName: `kills:${characterId}`,
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
    const MAX_CONSECUTIVE_EMPTY = 3;

    while (hasMore) {
      try {
        logger.info(`Fetching kills for ${char.name}, page ${page}`);
        const kills = await this.zkill.getCharacterKills(characterId, page);

        if (!kills.length) {
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= MAX_CONSECUTIVE_EMPTY) {
            logger.info(
              `No kills found for ${char.name} after ${consecutiveEmptyPages} empty pages, stopping`
            );
            hasMore = false;
            break;
          }
          page++;
          continue;
        }
        consecutiveEmptyPages = 0;

        logger.info(`Processing ${kills.length} kills for ${char.name}`);

        let foundTooOld = false;
        let lastProcessedId = checkpoint.lastSeenId;

        // Process each kill
        for (const kill of kills) {
          try {
            const killTime = new Date(kill.killmail_time);
            const killId = BigInt(kill.killmail_id);

            // Skip if we've already processed this kill
            if (killId <= checkpoint.lastSeenId) {
              skippedCount++;
              continue;
            }

            // Skip if it's too old
            if (killTime < cutoff) {
              tooOldCount++;
              foundTooOld = true;
              continue;
            }

            // Ingest the kill
            const result = await this.ingestKillmail(kill.killmail_id);
            if (result.success) {
              successfulIngestCount++;
              lastProcessedId = killId;
            } else {
              skippedCount++;
            }
          } catch (error) {
            logger.error(
              `Error processing kill ${kill.killmail_id} for ${char.name}:`,
              error
            );
          }
        }

        // Update checkpoint with the last processed ID
        if (lastProcessedId > checkpoint.lastSeenId) {
          await this.prisma.ingestionCheckpoint.update({
            where: { streamName: `kills:${characterId}` },
            data: {
              lastSeenId: lastProcessedId,
              lastSeenTime: new Date(),
            },
          });
        }

        // If we found a kill that's too old, stop after this page
        if (foundTooOld) {
          logger.info(`Found kills older than cutoff date, stopping backfill`);
          hasMore = false;
        } else {
          // Move to next page
          page++;
        }

        // If we've reached page 5 or processed more than 100 kills, stop to avoid overloading
        if (page > 5 || successfulIngestCount > 100) {
          logger.info(
            `Stopping backfill for ${char.name} after ${
              page - 1
            } pages (${successfulIngestCount} new kills)`
          );
          hasMore = false;
        }
      } catch (error) {
        logger.error(
          `Error fetching kills for ${char.name} at page ${page}:`,
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

    // Get the new kill count
    const newKillCount = await this.prisma.killFact.count({
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
    });

    logger.info(
      `Backfill for ${char.name} complete: ${successfulIngestCount} new kills ingested, ${skippedCount} skipped, ${tooOldCount} too old`
    );
    logger.info(
      `Character ${char.name} now has ${newKillCount} kills in database (${
        newKillCount - currentKillCount
      } new)`
    );
  }

  /**
   * Backfills losses via zKillboard API + Prisma upserts.
   * Now using pagination to be consistent with backfillKills.
   */
  public async backfillLosses(
    characterId: number,
    maxAgeDays = 30
  ): Promise<void> {
    try {
      const char = await this.prisma.character.findUnique({
        where: { eveId: characterId.toString() },
      });
      if (!char) {
        logger.warn(
          `Character ${characterId} not in DB, skipping loss backfill.`
        );
        return;
      }

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - maxAgeDays);

      logger.info(
        `Backfilling losses for ${characterId} since ${cutoff.toISOString()}`
      );

      // Get current loss count for this character
      const currentLossCount = await this.prisma.lossFact.count({
        where: {
          character_id: BigInt(characterId),
        },
      });

      logger.info(
        `Character ${characterId} has ${currentLossCount} losses in database before backfill`
      );

      // Get or create checkpoint
      const checkpoint = await this.prisma.ingestionCheckpoint.upsert({
        where: { streamName: `losses:${characterId}` },
        update: {},
        create: {
          streamName: `losses:${characterId}`,
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
      const MAX_CONSECUTIVE_EMPTY = 3;

      while (hasMore) {
        let losses: any[];
        try {
          logger.info(
            `Fetching loss page ${page} for character ${characterId}`
          );
          losses = await this.zkill.getCharacterLosses(characterId, page);
          logger.info(`Received ${losses.length} losses from page ${page}`);
        } catch (e: any) {
          logger.error(
            `Failed to fetch losses page ${page}: ${e.message || e}`
          );
          break;
        }

        if (losses.length === 0) {
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= MAX_CONSECUTIVE_EMPTY) {
            logger.info(
              `No losses found after ${consecutiveEmptyPages} empty pages, stopping`
            );
            break;
          }
          page++;
          continue;
        }
        consecutiveEmptyPages = 0;

        let foundTooOld = false;
        let lastProcessedId = checkpoint.lastSeenId;

        for (const loss of losses) {
          const id = loss.killmail_id;
          if (id == null) {
            logger.warn(
              `Loss without ID found, skipping: ${JSON.stringify(
                loss
              ).substring(0, 100)}...`
            );
            skippedCount++;
            continue;
          }

          try {
            const killId = BigInt(id);

            // Skip if we've already processed this loss
            if (killId <= checkpoint.lastSeenId) {
              skippedCount++;
              continue;
            }

            // Check age cutoff, but only after page 1
            if (page > 1 && loss.killmail_time) {
              const killDate = new Date(loss.killmail_time);
              if (killDate < cutoff) {
                logger.info(
                  `Loss ${id} from ${killDate.toISOString()} is older than cutoff (${cutoff.toISOString()}), will stop after this page`
                );
                tooOldCount++;
                foundTooOld = true;
                // Don't break immediately, continue processing this page
              }
            }

            // Create the loss record
            await this.prisma.lossFact.create({
              data: {
                killmail_id: killId,
                character_id: BigInt(characterId),
                kill_time: loss.killmail_time
                  ? new Date(loss.killmail_time)
                  : new Date(),
                ship_type_id: loss.victim?.ship_type_id ?? 0,
                system_id: loss.solar_system_id ?? 0,
                total_value: BigInt(Math.round(loss.zkb?.totalValue ?? 0)),
                attacker_count: loss.attackers?.length ?? 0,
                labels: loss.zkb?.labels ?? [],
              },
            });

            successfulIngestCount++;
            lastProcessedId = killId;
            logger.debug(`Loss ${id} was successfully ingested`);
          } catch (error) {
            logger.error(`Error ingesting loss ${id}: ${error}`);
            skippedCount++;
          }
        }

        // Update checkpoint with the last processed ID
        if (lastProcessedId > checkpoint.lastSeenId) {
          await this.prisma.ingestionCheckpoint.update({
            where: { streamName: `losses:${characterId}` },
            data: {
              lastSeenId: lastProcessedId,
              lastSeenTime: new Date(),
            },
          });
        }

        // If we found a loss that's too old, stop after this page
        if (foundTooOld) {
          hasMore = false;
        } else if (hasMore) {
          page++;
          await new Promise((r) => setTimeout(r, this.cfg.backoffMs));
        }
      }

      await this.prisma.character.update({
        where: { eveId: characterId.toString() },
        data: { lastBackfillAt: new Date() },
      });

      // Get final loss count
      const finalLossCount = await this.prisma.lossFact.count({
        where: {
          character_id: BigInt(characterId),
        },
      });

      const newLossesAdded = finalLossCount - currentLossCount;

      logger.info(
        `Completed backfillLosses for ${characterId}: ` +
          `Added ${newLossesAdded} new losses, ` +
          `Successful: ${successfulIngestCount}, ` +
          `Skipped: ${skippedCount}, ` +
          `Too old: ${tooOldCount}, ` +
          `Initial count: ${currentLossCount}, ` +
          `Final count: ${finalLossCount}`
      );
    } catch (e: any) {
      logger.error(`backfillLosses failed: ${e.message || e}`);
    }
  }

  /** Cleanly close cache & Prisma */
  public async close(): Promise<void> {
    await this.cache.close();
    await this.prisma.$disconnect();
  }
}
