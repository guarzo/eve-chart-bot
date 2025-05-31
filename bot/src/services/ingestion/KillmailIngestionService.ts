import { KillRepository } from "../../infrastructure/repositories/KillRepository";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";
import { ESIService } from "../ESIService";
import { retryOperation } from "../../utils/retry";
import { logger } from "../../lib/logger";
import {
  Killmail,
  KillmailAttacker,
  KillmailVictim,
} from "../../domain/killmail/Killmail";

import { ZKillboardClient } from "../../infrastructure/http/zkill";

// ——— Helpers ———
/** Safely coerce numbers/strings to BigInt, or return null */
const toBigInt = (val?: number | string | null): bigint | null =>
  val == null ? null : BigInt(typeof val === "string" ? val : Math.trunc(val));

export class KillmailIngestionService {
  private readonly killRepository: KillRepository;
  private readonly characterRepository: CharacterRepository;
  private readonly esiService: ESIService;
  private readonly zkill: ZKillboardClient;

  constructor() {
    this.killRepository = new KillRepository();
    this.characterRepository = new CharacterRepository();
    this.esiService = new ESIService();
    this.zkill = new ZKillboardClient();
  }

  /**
   * Start the killmail ingestion service
   */
  public async start(): Promise<void> {
    logger.info("Starting killmail ingestion service...");

    // Check if backfill is enabled via environment variable
    if (process.env.ENABLE_BACKFILL !== "true") {
      logger.info(
        "Killmail ingestion service started successfully (backfill disabled)"
      );
      return;
    }

    // Initial backfill of all characters
    const characters = await this.characterRepository.getAllCharacters();
    let completedCount = 0;
    let errorCount = 0;

    for (const character of characters) {
      try {
        await this.backfillKills(BigInt(character.eveId));
        completedCount++;
      } catch (error) {
        errorCount++;
        logger.error(
          `Error backfilling kills for character ${character.eveId}:`,
          error
        );
      }
    }

    logger.info(
      `Killmail ingestion service started successfully - Backfilled ${characters.length} characters (${completedCount} completed, ${errorCount} errors)`
    );
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
    skipReason?: string;
  }> {
    try {
      // 1) Skip if already in DB - killmails are immutable
      const existingKillmail = await this.killRepository.getKillmail(
        killId.toString()
      );
      if (existingKillmail) {
        return {
          success: false,
          existing: true,
          skipped: true,
          skipReason: "already in database",
        };
      }

      // 2) Fetch from zKillboard with retry (15s timeout for zKill)
      const zk = await retryOperation(
        () => this.zkill.getKillmail(killId),
        `Fetching zKill data for killmail ${killId}`,
        {
          maxRetries: 3,
          initialRetryDelay: 5000,
          timeout: 15000,
        }
      );

      if (!zk) {
        logger.warn(`No zKill data for killmail ${killId}`);
        return { success: false, skipped: true, skipReason: "no zKill data" };
      }

      // Get the kill data from the response
      const killData = zk[killId.toString()] || zk;
      if (
        !killData ||
        !killData.killmail_id ||
        !killData.zkb ||
        !killData.zkb.hash
      ) {
        logger.warn(`Invalid zKill data for killmail ${killId}`, {
          hasKillData: !!killData,
          hasKillmailId: !!killData?.killmail_id,
          hasZkb: !!killData?.zkb,
          hasHash: !!killData?.zkb?.hash,
          responseType: typeof zk,
          isArray: Array.isArray(zk),
          responseKeys: Object.keys(zk),
        });
        return {
          success: false,
          skipped: true,
          skipReason: "invalid zKill data",
        };
      }

      // 3) Fetch from ESI with caching and retry (30s timeout for ESI)
      const esi = await retryOperation(
        () =>
          this.esiService.getKillmail(killData.killmail_id, killData.zkb.hash),
        `Fetching ESI data for killmail ${killId}`,
        {
          maxRetries: 3,
          initialRetryDelay: 5000,
          timeout: 30000,
        }
      );

      if (!esi) {
        logger.error(
          `Failed to fetch ESI data for killmail ${killId} after retries`
        );
        return { success: false, error: "Failed to fetch ESI data" };
      }
      if (!esi.victim) {
        logger.warn(
          `Invalid ESI data for killmail ${killId} - missing victim data`
        );
        return {
          success: false,
          skipped: true,
          skipReason: "invalid ESI data",
        };
      }

      // 4) Create domain entities
      const victim = new KillmailVictim({
        characterId: toBigInt(esi.victim.character_id) ?? undefined,
        corporationId: toBigInt(esi.victim.corporation_id) ?? undefined,
        allianceId: toBigInt(esi.victim.alliance_id) ?? undefined,
        shipTypeId: esi.victim.ship_type_id,
        damageTaken: esi.victim.damage_taken,
      });

      const attackers = (esi.attackers as any[]).map(
        (a: any) =>
          new KillmailAttacker({
            characterId: toBigInt(a.character_id) ?? undefined,
            corporationId: toBigInt(a.corporation_id) ?? undefined,
            allianceId: toBigInt(a.alliance_id) ?? undefined,
            damageDone: a.damage_done,
            finalBlow: a.final_blow,
            securityStatus: a.security_status,
            shipTypeId: a.ship_type_id,
            weaponTypeId: a.weapon_type_id,
          })
      );

      // 5) Determine which characters are tracked
      const allIds = [
        victim.characterId,
        ...attackers.map((att) => att.characterId),
      ]
        .filter((x): x is bigint => x != null)
        .map((b) => b.toString());

      const tracked = await this.characterRepository.getCharactersByEveIds(
        allIds
      );

      // Debug logging for backfill operations
      const isBackfill = this.isBackfillOperation();
      if (isBackfill && tracked.length === 0) {
        logger.warn(`No tracked characters found for killmail ${killId}`, {
          allCharacterIds: allIds,
          victimId: victim.characterId?.toString(),
          attackerIds: attackers
            .map((a) => a.characterId?.toString())
            .filter(Boolean),
          isBackfill,
        });
      }

      if (tracked.length === 0) {
        return {
          success: false,
          skipped: true,
          skipReason: "no tracked characters",
        };
      }

      // 6) For backfill (kills/losses), we only need at least one tracked character
      // For RedisQ, we need to validate there is a tracked attacker or victim
      if (!isBackfill) {
        // For RedisQ, ensure we have at least one tracked character involved
        const victimId = victim.characterId?.toString();
        const hasTrackedVictim =
          victimId !== undefined && tracked.some((c) => c.eveId === victimId);
        const hasTrackedAttacker = attackers.some((a) => {
          const attackerId = a.characterId?.toString();
          return (
            attackerId !== undefined &&
            tracked.some((c) => c.eveId === attackerId)
          );
        });

        if (!hasTrackedVictim && !hasTrackedAttacker) {
          return {
            success: false,
            skipped: true,
            skipReason: "no tracked characters in killmail",
          };
        }
      }

      const killmail = new Killmail({
        killmailId: BigInt(killId),
        killTime: new Date(esi.killmail_time),
        systemId: esi.solar_system_id,
        totalValue: BigInt(Math.round(killData.zkb.totalValue)),
        points: killData.zkb.points,
        npc: attackers.every((a) => !a.characterId), // NPC kill if no player attackers
        solo: attackers.length === 1,
        awox: false,
        shipTypeId: esi.victim.ship_type_id,
        labels: killData.zkb.labels ?? [],
        victim,
        attackers,
      });

      await this.killRepository.saveKillmail(killmail);

      return {
        success: true,
        timestamp: esi.killmail_time,
        age: Math.floor(
          (Date.now() - new Date(esi.killmail_time).getTime()) / 1000 / 60 / 60
        ),
      };
    } catch (error: any) {
      logger.error(`Error ingesting killmail ${killId}: ${error.message}`, {
        error,
        stack: error.stack,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Backfill kills for a character
   */
  public async backfillKills(
    characterId: bigint,
    maxAgeDays: number = 30
  ): Promise<void> {
    const startTime = Date.now();
    try {
      // Get character from repository
      const character = await this.characterRepository.getCharacter(
        characterId.toString()
      );
      if (!character) {
        throw new Error(`Character ${characterId} not found`);
      }

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

      // Get last processed killmail ID
      const checkpoint =
        await this.characterRepository.upsertIngestionCheckpoint(
          "kills",
          characterId
        );

      let page = 1;
      let hasMore = true;
      let lastProcessedId = checkpoint.lastSeenId;
      let successfulIngestCount = 0;
      let skippedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;
      let tooOldCount = 0;
      let totalKillmailsProcessed = 0;
      let skipReasons: Record<string, number> = {};
      let reachedCutoff = false;

      while (hasMore && !reachedCutoff) {
        try {
          // Fetch killmails from zKillboard
          const killmails = await retryOperation(
            () => this.zkill.getCharacterKills(Number(characterId), page),
            `Fetching kills for character ${characterId}`,
            {
              maxRetries: 3,
              initialRetryDelay: 5000,
              timeout: 15000,
            }
          );

          if (!killmails || killmails.length === 0) {
            hasMore = false;
            continue;
          }

          let allKillsInDb = true;
          let hitCheckpoint = false;

          // Process each killmail
          for (const [index, killmail] of killmails.entries()) {
            try {
              if (!killmail || !killmail.killmail_id || !killmail.zkb) {
                continue;
              }

              const killId = killmail.killmail_id;

              // Check if we've hit the checkpoint from a previous run
              if (killId <= lastProcessedId) {
                hitCheckpoint = true;
                hasMore = false;
                break;
              }

              // Get full killmail data from ESI to check age
              const esiData = await retryOperation(
                () => this.esiService.getKillmail(killId, killmail.zkb.hash),
                `Fetching ESI data for killmail ${killId}`,
                {
                  maxRetries: 3,
                  initialRetryDelay: 5000,
                  timeout: 30000,
                }
              );

              if (!esiData) {
                logger.warn(`Failed to fetch ESI data for killmail ${killId}`);
                continue;
              }

              // Check killmail age
              const killTime = new Date(esiData.killmail_time);

              if (killTime < cutoffDate) {
                tooOldCount++;
                reachedCutoff = true;
                hasMore = false;
                break;
              }

              const result = await this.ingestKillmail(killId);
              if (result.success) {
                successfulIngestCount++;
                allKillsInDb = false;
              } else if (result.skipped) {
                if (result.skipReason === "already in database") {
                  duplicateCount++;
                } else {
                  skippedCount++;
                  if (result.skipReason) {
                    skipReasons[result.skipReason] =
                      (skipReasons[result.skipReason] || 0) + 1;
                  }
                }
              } else if (result.error) {
                errorCount++;
                allKillsInDb = false;
                logger.error(
                  `Error processing killmail ${killId}: ${result.error}`
                );
              }
              totalKillmailsProcessed++;
            } catch (killmailError: any) {
              logger.error(
                `Error processing individual killmail at index ${index}:`,
                {
                  error: killmailError.message,
                  stack: killmailError.stack,
                  killmailId: killmail?.killmail_id,
                }
              );
              errorCount++;
              allKillsInDb = false;
            }
          }

          // If we've hit the checkpoint or all kills are in DB, stop
          if (hitCheckpoint) {
            break;
          }

          // If all kills from this page are already in DB, stop
          if (allKillsInDb) {
            hasMore = false;
            break;
          }

          // If we've reached the cutoff or processed all killmails, stop
          if (reachedCutoff || !hasMore) {
            break;
          }

          page++;
        } catch (error: any) {
          logger.error(`Error fetching kills for character ${characterId}:`, {
            error: error.message,
            stack: error.stack,
            response: error.response?.data,
            status: error.response?.status,
            page,
          });
          errorCount++;
          // Don't break the loop on error, just continue to next page
          page++;
          // If we get a 404 or 403, stop trying
          if (
            error.response?.status === 404 ||
            error.response?.status === 403
          ) {
            hasMore = false;
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.info(
        `Completed backfill for character ${characterId} in ${duration}ms: ${successfulIngestCount} ingested, ${duplicateCount} duplicates, ${skippedCount} other skipped, ${errorCount} errors, ${tooOldCount} too old, ${totalKillmailsProcessed} total processed`
      );

      // Only log skip reasons if there are non-duplicate skips
      if (Object.keys(skipReasons).length > 0) {
        logger.info(
          `Non-duplicate skip reasons for character ${characterId}: ${Object.entries(
            skipReasons
          )
            .map(([reason, count]) => `${reason}: ${count}`)
            .join(", ")}`
        );
      }
    } catch (error) {
      logger.error(
        `Error backfilling kills for character ${characterId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Backfill losses for a character
   */
  public async backfillLosses(
    characterId: bigint,
    maxAgeDays: number = 30
  ): Promise<void> {
    const startTime = Date.now();
    try {
      logger.info(
        `Starting backfill for character ${characterId} (max age: ${maxAgeDays} days)`
      );

      // Get character from repository
      const character = await this.characterRepository.getCharacter(
        characterId.toString()
      );
      if (!character) {
        throw new Error(`Character ${characterId} not found`);
      }

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
      logger.info(`Cutoff date for backfill: ${cutoffDate.toISOString()}`);

      // Get last processed killmail ID
      const checkpoint =
        await this.characterRepository.upsertIngestionCheckpoint(
          "losses",
          characterId
        );

      let page = 1;
      let hasMore = true;
      let lastProcessedId = checkpoint.lastSeenId;
      let successfulIngestCount = 0;
      let skippedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;
      let tooOldCount = 0;
      let totalLossmailsProcessed = 0;
      let skipReasons: Record<string, number> = {};

      while (hasMore) {
        try {
          // Fetch losses from zKillboard
          const losses = await retryOperation(
            () => this.zkill.getCharacterLosses(Number(characterId)),
            `Fetching losses for character ${characterId}`,
            {
              maxRetries: 3,
              initialRetryDelay: 5000,
              timeout: 15000,
            }
          );

          if (!losses || losses.length === 0) {
            logger.info(`No more losses found for character ${characterId}`);
            hasMore = false;
            continue;
          }

          // Process each loss
          for (const loss of losses) {
            if (!loss || !loss.killmail_id || !loss.zkb) {
              logger.debug("Invalid loss data:", {
                loss,
                hasKillmailId: !!loss?.killmail_id,
                hasZkb: !!loss?.zkb,
              });
              continue;
            }

            const killId = loss.killmail_id;
            if (killId <= lastProcessedId) {
              logger.info(
                `Reached previously processed loss ${killId}, stopping`
              );
              hasMore = false;
              break;
            }

            // Check loss age
            const lossTime = new Date(loss.killmail_time);
            if (lossTime < cutoffDate) {
              logger.info(
                `Reached loss older than cutoff date (${cutoffDate.toISOString()}), stopping`
              );
              tooOldCount++;
              hasMore = false;
              break;
            }

            const result = await this.ingestKillmail(killId);
            if (result.success) {
              successfulIngestCount++;
            } else if (result.skipped) {
              if (result.skipReason === "already in database") {
                duplicateCount++;
              } else {
                skippedCount++;
                if (result.skipReason) {
                  skipReasons[result.skipReason] =
                    (skipReasons[result.skipReason] || 0) + 1;
                }
              }
            } else if (result.error) {
              errorCount++;
            }
            totalLossmailsProcessed++;
          }

          page++;
        } catch (error: any) {
          logger.error(`Error fetching losses for character ${characterId}:`, {
            error: error.message,
            stack: error.stack,
            response: error.response?.data,
            status: error.response?.status,
          });
          errorCount++;
          // Don't break the loop on error, just continue to next page
          page++;
          // If we get a 404 or 403, stop trying
          if (
            error.response?.status === 404 ||
            error.response?.status === 403
          ) {
            hasMore = false;
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.info(
        `Completed backfill for character ${characterId} in ${duration}ms: ${successfulIngestCount} ingested, ${duplicateCount} duplicates, ${skippedCount} other skipped, ${errorCount} errors, ${tooOldCount} too old, ${totalLossmailsProcessed} total processed`
      );

      // Only log skip reasons if there are non-duplicate skips
      if (Object.keys(skipReasons).length > 0) {
        logger.info(
          `Non-duplicate skip reasons for character ${characterId}: ${Object.entries(
            skipReasons
          )
            .map(([reason, count]) => `${reason}: ${count}`)
            .join(", ")}`
        );
      }
    } catch (error) {
      logger.error(
        `Error backfilling losses for character ${characterId}:`,
        error
      );
      throw error;
    }
  }

  private isBackfillOperation(): boolean {
    // Check if we're in a backfill operation by looking at the call stack
    const stack = new Error().stack || "";
    return stack.includes("backfillKills") || stack.includes("backfillLosses");
  }
}
