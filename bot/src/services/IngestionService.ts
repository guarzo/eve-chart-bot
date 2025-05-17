// services/IngestionService.ts
import { PrismaClient, Prisma } from "@prisma/client";
import { ZkillClient } from "../lib/api/ZkillClient";
import { MapClient } from "../lib/api/MapClient";
import { RedisCache } from "../lib/cache/RedisCache";
import { IngestionConfig } from "../types/ingestion";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";
import { ESIService } from "./ESIService";
import axios from "axios";

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
   * Syncs users' characters into Character & CharacterGroup tables.
   */
  public async syncUserCharacters(slug: string): Promise<void> {
    const cacheKey = `characters:${slug}`;
    const resp = await this.cache.getOrSet(cacheKey, () =>
      this.map.getUserCharacters(slug)
    );
    const users = (resp?.data as any[]) ?? [];
    let processed = 0;
    let skipped = 0;

    for (const user of users) {
      const mainId = user.main_character_eve_id;
      const chars = user.characters as any[];
      logger.info(
        `User ${slug}: main=${mainId ?? "none"}, count=${chars.length}`
      );

      if (chars.length === 0) {
        logger.warn(`Skipping user with no characters`);
        skipped++;
        continue;
      }

      // Find existing group if any
      const existing = await this.prisma.character.findMany({
        where: {
          eveId: { in: chars.map((c) => c.eve_id.toString()) },
          characterGroupId: { not: null },
        },
        include: { characterGroup: true },
      });
      let group = existing[0]?.characterGroup;

      if (!group) {
        const grpSlug = `${slug}_${mainId ?? uuidv4()}`;
        group = await this.prisma.$transaction(async (tx) => {
          const found = await tx.characterGroup.findUnique({
            where: { slug: grpSlug },
            include: { characters: true },
          });
          if (found) return found;
          return tx.characterGroup.create({
            data: { slug: grpSlug, mainCharacterId: null },
          });
        });
      }

      if (!group) {
        logger.warn(`Could not create/find group for user ${slug}`);
        skipped++;
        continue;
      }

      // Reset main flags
      await this.prisma.character.updateMany({
        where: { characterGroupId: group.id },
        data: { isMain: false },
      });

      for (const c of chars) {
        processed++;
        const isMain = c.eve_id === mainId;
        const charData = {
          eveId: c.eve_id.toString(),
          name: c.name,
          allianceId: c.alliance_id,
          allianceTicker: c.alliance_ticker,
          corporationId: c.corporation_id,
          corporationTicker: c.corporation_ticker,
          isMain,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          const up = await this.prisma.character.upsert({
            where: { eveId: charData.eveId },
            update: {
              name: charData.name,
              allianceId: charData.allianceId,
              allianceTicker: charData.allianceTicker,
              corporationId: charData.corporationId,
              corporationTicker: charData.corporationTicker,
              isMain: charData.isMain,
              characterGroupId: group.id,
              mainCharacterId: isMain ? null : mainId,
            },
            create: {
              ...charData,
              characterGroupId: group.id,
              mainCharacterId: isMain ? null : mainId,
            },
          });

          if (up.isMain && mainId) {
            await this.prisma.characterGroup.update({
              where: { id: group.id },
              data: { mainCharacterId: up.eveId },
            });
            await this.prisma.character.updateMany({
              where: {
                characterGroupId: group.id,
                eveId: { not: up.eveId },
              },
              data: { mainCharacterId: up.eveId },
            });
          }
        } catch (e: any) {
          skipped++;
          logger.error(
            { error: e.message || e, char: charData },
            `Failed to upsert character ${c.eve_id}`
          );
        }
      }
    }

    const totalChars = await this.prisma.character.count();
    const totalGroups = await this.prisma.characterGroup.count();
    logger.info(
      `Character sync complete: processed=${processed}, skipped=${skipped}, chars=${totalChars}, groups=${totalGroups}`
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

    const checkpoint = await this.prisma.ingestionCheckpoint.findUnique({
      where: { streamName: `kills:${characterId}` },
    });
    let lastSeenId = checkpoint?.lastSeenId ?? null;

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      let kills: any[];
      try {
        kills = await this.zkill.getCharacterKills(characterId, page);
      } catch (e: any) {
        logger.error(`Failed fetch kills page ${page}: ${e.message || e}`);
        break;
      }
      if (kills.length === 0) break;

      for (const k of kills) {
        const id = k.killmail_id;
        if (id == null) continue;
        const big = BigInt(id);

        if (lastSeenId != null && big <= lastSeenId) {
          hasMore = false;
          break;
        }

        const res = await this.ingestKillmail(id);
        if (res.timestamp) {
          const kd = new Date(res.timestamp);
          if (kd < cutoff) {
            hasMore = false;
            break;
          }
        }

        await this.prisma.ingestionCheckpoint.upsert({
          where: { streamName: `kills:${characterId}` },
          update: { lastSeenId: big, lastSeenTime: new Date() },
          create: {
            streamName: `kills:${characterId}`,
            lastSeenId: big,
            lastSeenTime: new Date(),
          },
        });
        lastSeenId = big;
      }

      if (hasMore) {
        page++;
        await new Promise((r) => setTimeout(r, this.cfg.backoffMs));
      }
    }

    await this.prisma.character.update({
      where: { eveId: characterId.toString() },
      data: { lastBackfillAt: new Date() },
    });
    logger.info(`Completed backfillKills for ${characterId}`);
  }

  /**
   * Backfills losses via zKillboard API + Prisma upserts.
   */
  public async backfillLosses(
    characterId: number,
    maxAgeDays = 30
  ): Promise<void> {
    try {
      const url = `${this.cfg.zkillApiUrl}/losses/characterID/${characterId}/`;
      const resp = await axios.get<any[]>(url, {
        headers: { "User-Agent": "EVE-Chart-Bot/1.0" },
      });
      const losses = resp.data;
      let processed = 0;
      let skipped = 0;

      for (const loss of losses) {
        try {
          const id = loss.killmail_id;
          if (id == null) continue;
          const big = BigInt(id);

          const exists = await this.prisma.lossFact.findUnique({
            where: { killmail_id: big },
          });
          if (exists) {
            skipped++;
            continue;
          }

          if (loss.killmail_time) {
            const age = Math.floor(
              (Date.now() - new Date(loss.killmail_time).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            if (age > maxAgeDays) {
              skipped++;
              continue;
            }
          }

          await this.prisma.lossFact.create({
            data: {
              killmail_id: big,
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

          processed++;
        } catch (e: any) {
          logger.error(
            `Error processing loss ${loss.killmail_id}: ${e.message || e}`
          );
        }
      }

      logger.info(
        `backfillLosses complete: created=${processed}, skipped=${skipped}`
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

  /**
   * Start real-time ingestion of killmails
   * (Placeholder implementation - will be expanded in future)
   */
  public async startRealTimeIngestion(): Promise<void> {
    logger.info("Real-time ingestion started (stub implementation)");
    logger.warn("This is a placeholder - actual implementation coming soon");
    // Implementation will come in a future update
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
