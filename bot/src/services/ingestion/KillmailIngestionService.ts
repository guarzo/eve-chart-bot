import { KillRepository } from "../../infrastructure/repositories/KillRepository";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";
import { ESIService } from "../ESIService";
import { logger } from "../../lib/logger";
import {
  KillmailAttacker,
  KillmailVictim,
} from "../../domain/killmail/Killmail";
import { ZKillboardClient } from "../../infrastructure/http/zkill";
import { Configuration } from "../../config";
import { BaseIngestionService, IngestionConfig } from "./BaseIngestionService";

// ——— Helpers ———
/** Safely coerce numbers/strings to BigInt, or return null */
const toBigInt = (val?: number | string | null): bigint | null =>
  val == null ? null : BigInt(typeof val === "string" ? val : Math.trunc(val));

export class KillmailIngestionService extends BaseIngestionService {
  private readonly killRepository: KillRepository;
  private readonly characterRepository: CharacterRepository;
  private readonly esiService: ESIService;
  private readonly zkill: ZKillboardClient;

  constructor(config: Partial<IngestionConfig> = {}) {
    super(config);
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

    // DEBUG: Check what we're actually reading
    logger.info(
      `DEBUG: ENABLE_BACKFILL value is: "${
        Configuration.ingestion.enableBackfill
      }" (type: ${typeof Configuration.ingestion.enableBackfill})`
    );

    // Check if backfill is enabled via centralized configuration
    if (!Configuration.ingestion.enableBackfill) {
      logger.info(
        "Killmail ingestion service started successfully (backfill disabled)"
      );
      return;
    }

    // Initial backfill of all characters - both kills and losses
    const characters = await this.characterRepository.getAllCharacters();
    let killsCompletedCount = 0;
    let killsErrorCount = 0;
    let lossesCompletedCount = 0;
    let lossesErrorCount = 0;

    logger.info(
      `Starting backfill for ${characters.length} characters (both kills and losses)`
    );

    for (const character of characters) {
      try {
        logger.info(
          `Backfilling kills for character: ${character.name} (${character.eveId})`
        );
        await this.backfillKills(BigInt(character.eveId));
        killsCompletedCount++;
      } catch (error) {
        killsErrorCount++;
        logger.error(
          `Error backfilling kills for character ${character.eveId}:`,
          error
        );
      }

      try {
        logger.info(
          `Backfilling losses for character: ${character.name} (${character.eveId})`
        );
        await this.backfillLosses(BigInt(character.eveId));
        lossesCompletedCount++;
      } catch (error) {
        lossesErrorCount++;
        logger.error(
          `Error backfilling losses for character ${character.eveId}:`,
          error
        );
      }
    }

    logger.info(
      `Killmail ingestion service started successfully - Backfilled ${characters.length} characters:
      Kills: ${killsCompletedCount} completed, ${killsErrorCount} errors
      Losses: ${lossesCompletedCount} completed, ${lossesErrorCount} errors`
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
      const zk = await this.retryZkill(
        () => this.zkill.getKillmail(killId),
        `Fetching zKill data for killmail ${killId}`
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
      const esi = await this.retryEsi(
        () =>
          this.esiService.getKillmail(killData.killmail_id, killData.zkb.hash),
        `Fetching ESI data for killmail ${killId}`
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

      // 6) Build a single structured data object for transactional ingestion
      const killmailData = {
        killmailId: BigInt(killId),
        killTime: new Date(esi.killmail_time),
        npc: attackers.every((a) => !a.characterId), // TODO: use correct floag from killmail- NPC kill if no player attackers
        solo: attackers.length === 1,
        awox: false, // TODO: implement awox logic -- use correct flag from killmail
        shipTypeId: esi.victim.ship_type_id,
        systemId: esi.solar_system_id,
        labels: killData.zkb.labels ?? [],
        totalValue: BigInt(Math.round(killData.zkb.totalValue)),
        points: killData.zkb.points,
        attackers: attackers.map((a) => ({
          characterId: a.characterId,
          corporationId: a.corporationId,
          allianceId: a.allianceId,
          damageDone: a.damageDone,
          finalBlow: a.finalBlow,
          securityStatus: a.securityStatus,
          shipTypeId: a.shipTypeId,
          weaponTypeId: a.weaponTypeId,
        })),
        victim: {
          characterId: victim.characterId,
          corporationId: victim.corporationId,
          allianceId: victim.allianceId,
          shipTypeId: victim.shipTypeId,
          damageTaken: victim.damageTaken,
        },
      };

      // 7) Call the new transactionally-safe ingestion method
      await this.killRepository.ingestKillTransaction(killmailData);

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
      logger.info(`Cutoff date for backfill: ${cutoffDate.toISOString()}`);

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

      while (hasMore) {
        try {
          // Fetch killmails from zKillboard
          const killmails = await this.retryZkill(
            () => this.zkill.getCharacterKills(Number(characterId), page),
            `Fetching kills for character ${characterId}`
          );

          if (!killmails || killmails.length === 0) {
            hasMore = false;
            continue;
          }

          // Process killmails in batches
          const results = await this.processBatch(
            killmails,
            async (killmail) => {
              if (!killmail || !killmail.killmail_id || !killmail.zkb) {
                return null;
              }

              const killId = killmail.killmail_id;

              // Check if we've hit the checkpoint from a previous run
              if (killId <= lastProcessedId) {
                hasMore = false;
                return null;
              }

              // Check killmail age
              const killTime = new Date(killmail.killmail_time);
              if (killTime < cutoffDate) {
                logger.info(
                  `Reached killmail older than cutoff date (${cutoffDate.toISOString()}), stopping`
                );
                tooOldCount++;
                hasMore = false;
                return null;
              }

              return await this.ingestKillmail(killId);
            },
            `Processing kills for character ${characterId}`
          );

          // Process results
          for (const result of results) {
            if (!result) continue;

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
            totalKillmailsProcessed++;
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
          page++;
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
    } catch (error: any) {
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

      logger.info(
        `Starting to fetch losses for character ${characterId} (last processed ID: ${lastProcessedId})`
      );

      while (hasMore) {
        try {
          logger.info(
            `Fetching page ${page} of losses for character ${characterId}`
          );
          // Fetch losses from zKillboard with optimized timeout
          const losses = await this.retryZkill(
            () => this.zkill.getCharacterLosses(Number(characterId), page),
            `Fetching losses for character ${characterId}`
          );

          if (!losses || losses.length === 0) {
            logger.info(`No more losses found for character ${characterId}`);
            hasMore = false;
            continue;
          }

          logger.info(`Processing ${losses.length} losses from page ${page}`);

          // Process losses in parallel batches of 5
          const batchSize = 5;
          for (let i = 0; i < losses.length; i += batchSize) {
            const batch = losses.slice(i, i + batchSize);
            await Promise.all(
              batch.map(async (loss) => {
                if (!loss || !loss.killmail_id || !loss.zkb) {
                  logger.debug("Invalid loss data:", {
                    loss,
                    hasKillmailId: !!loss?.killmail_id,
                    hasZkb: !!loss?.zkb,
                  });
                  return;
                }

                const killId = loss.killmail_id;
                logger.debug(`Processing loss ${killId}`);

                if (killId <= lastProcessedId) {
                  logger.info(
                    `Reached previously processed loss ${killId}, stopping`
                  );
                  hasMore = false;
                  return;
                }

                // Check loss age
                const lossTime = new Date(loss.killmail_time);
                if (lossTime < cutoffDate) {
                  logger.info(
                    `Reached loss older than cutoff date (${cutoffDate.toISOString()}), stopping`
                  );
                  tooOldCount++;
                  hasMore = false;
                  return;
                }

                const result = await this.ingestKillmail(killId);
                if (result.success) {
                  successfulIngestCount++;
                  logger.debug(`Successfully ingested loss ${killId}`);
                } else if (result.skipped) {
                  if (result.skipReason === "already in database") {
                    duplicateCount++;
                    logger.debug(`Skipped duplicate loss ${killId}`);
                  } else {
                    skippedCount++;
                    if (result.skipReason) {
                      skipReasons[result.skipReason] =
                        (skipReasons[result.skipReason] || 0) + 1;
                      logger.debug(
                        `Skipped loss ${killId}: ${result.skipReason}`
                      );
                    }
                  }
                } else if (result.error) {
                  errorCount++;
                  logger.error(
                    `Error processing loss ${killId}: ${result.error}`
                  );
                }
                totalLossmailsProcessed++;
              })
            );
          }

          logger.info(`Completed processing page ${page} of losses`);
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

  /**
   * Backfill kills for a character using checkpoint-based approach
   */
  public async backfillKillsWithCheckpoint(characterId: bigint): Promise<void> {
    try {
      // 1. Fetch the character row to read last_backfill_at
      const character = await this.characterRepository.getCharacter(
        characterId.toString()
      );
      if (!character) {
        throw new Error(`Character ${characterId} not found`);
      }

      const sinceDate = character.lastBackfillAt
        ? character.lastBackfillAt
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago as default

      logger.info(
        `[Backfill] Starting checkpoint-based backfill for character ${characterId} since ${sinceDate.toISOString()}`
      );

      // 2. Call zKill API to get all kills since sinceDate
      let page = 1;
      let hasMore = true;
      let totalKills = 0;
      let ingestedKills = 0;
      let skippedKills = 0;
      let errorCount = 0;

      while (hasMore) {
        try {
          const killmails = await this.retryZkill(
            () => this.zkill.getCharacterKills(Number(characterId), page),
            `Fetching kills for character ${characterId}, page ${page}`
          );

          if (!killmails || killmails.length === 0) {
            hasMore = false;
            continue;
          }

          for (const kill of killmails) {
            if (!kill || !kill.killmail_id || !kill.zkb) {
              continue;
            }

            totalKills++;

            // Get ESI data to check kill time
            const esiData = await this.retryEsi(
              () =>
                this.esiService.getKillmail(kill.killmail_id, kill.zkb.hash),
              `Fetching ESI data for killmail ${kill.killmail_id}`
            );

            if (!esiData) {
              errorCount++;
              continue;
            }

            const killTime = new Date(esiData.killmail_time);

            // Only process kills newer than sinceDate
            if (killTime > sinceDate) {
              const result = await this.ingestKillmail(kill.killmail_id);
              if (result.success) {
                ingestedKills++;
              } else {
                skippedKills++;
              }
            } else {
              // If we've reached kills older than sinceDate, we can stop
              hasMore = false;
              break;
            }
          }

          page++;
        } catch (error: any) {
          logger.error(
            `Error fetching kills for character ${characterId}, page ${page}:`,
            error
          );
          errorCount++;
          // Continue to next page on error
          page++;
          // Stop if we get 404 or 403
          if (
            error.response?.status === 404 ||
            error.response?.status === 403
          ) {
            hasMore = false;
          }
        }
      }

      // 3. After completion, update last_backfill_at
      await this.characterRepository.updateLastBackfillAt(characterId);

      logger.info(
        `[Backfill] character ${characterId}: totalKills=${totalKills}, ingested=${ingestedKills}, skipped=${skippedKills}, errors=${errorCount}`
      );
    } catch (error: any) {
      logger.error(
        `Error in checkpoint-based backfill for character ${characterId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Ingest partial killmail data (zKillboard only) and mark for later enrichment
   */
  public async ingestPartialKillmail(zkillData: {
    killmailId: number;
    killTime: string;
    npc: boolean;
    solo: boolean;
    awox: boolean;
    shipTypeId?: number;
    systemId: number;
    labels: string[];
    totalValue: number;
    points: number;
  }): Promise<{ success: boolean; reason?: string }> {
    try {
      // Check if killmail already exists as fully populated
      const existing = await this.killRepository.getKillmail(
        zkillData.killmailId.toString()
      );
      if (existing) {
        return { success: false, reason: "killmail already exists" };
      }

      const partialData = {
        killmailId: BigInt(zkillData.killmailId),
        killTime: new Date(zkillData.killTime),
        npc: zkillData.npc,
        solo: zkillData.solo,
        awox: zkillData.awox,
        shipTypeId: zkillData.shipTypeId || 0, // Default ship type if missing
        systemId: zkillData.systemId,
        labels: zkillData.labels,
        totalValue: BigInt(Math.round(zkillData.totalValue)),
        points: zkillData.points,
      };

      await this.killRepository.ingestPartialKillmail(partialData);

      logger.debug(
        `Ingested partial killmail ${zkillData.killmailId} - will be enriched later`
      );
      return { success: true };
    } catch (error: any) {
      logger.error(
        `Error ingesting partial killmail ${zkillData.killmailId}: ${error.message}`,
        { error }
      );
      return { success: false, reason: error.message };
    }
  }

  /**
   * Enrich partial killmails with full ESI data
   */
  public async enrichPartialKillmails(batchSize: number = 50): Promise<{
    processed: number;
    enriched: number;
    failed: number;
    errors: string[];
  }> {
    const stats = {
      processed: 0,
      enriched: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      // Get batch of partial killmails
      const partialKillmails = await this.killRepository.getPartialKillmails(
        batchSize
      );

      if (partialKillmails.length === 0) {
        logger.debug("No partial killmails found for enrichment");
        return stats;
      }

      logger.info(
        `Starting enrichment of ${partialKillmails.length} partial killmails`
      );

      for (const partial of partialKillmails) {
        stats.processed++;

        try {
          // Use circuit breaker for zKill call
          const zkillResult = await this.retryZkill(
            () => this.zkill.getKillmail(Number(partial.killmail_id)),
            `Fetching zKill data for enrichment ${partial.killmail_id}`
          );

          if (!zkillResult) {
            stats.failed++;
            stats.errors.push(
              `No zKill data for killmail ${partial.killmail_id}`
            );
            continue;
          }

          const killData =
            zkillResult[partial.killmail_id.toString()] || zkillResult;
          if (!killData?.zkb?.hash) {
            stats.failed++;
            stats.errors.push(
              `Invalid zKill data for killmail ${partial.killmail_id}`
            );
            continue;
          }

          // Use circuit breaker for ESI call
          const esiResult = await this.retryEsi(
            () =>
              this.esiService.getKillmail(
                Number(partial.killmail_id),
                killData.zkb.hash
              ),
            `Fetching ESI data for enrichment ${partial.killmail_id}`
          );

          if (!esiResult?.victim) {
            stats.failed++;
            stats.errors.push(
              `No ESI victim data for killmail ${partial.killmail_id}`
            );
            continue;
          }

          // Check if any tracked characters are involved
          const victim = new KillmailVictim({
            characterId: toBigInt(esiResult.victim.character_id) ?? undefined,
            corporationId:
              toBigInt(esiResult.victim.corporation_id) ?? undefined,
            allianceId: toBigInt(esiResult.victim.alliance_id) ?? undefined,
            shipTypeId: esiResult.victim.ship_type_id,
            damageTaken: esiResult.victim.damage_taken,
          });

          const attackers = (esiResult.attackers as any[]).map(
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

          const allIds = [
            victim.characterId,
            ...attackers.map((att) => att.characterId),
          ]
            .filter((x): x is bigint => x != null)
            .map((b) => b.toString());

          const tracked = await this.characterRepository.getCharactersByEveIds(
            allIds
          );

          if (tracked.length === 0) {
            // No tracked characters - skip enrichment but keep as partial
            logger.debug(
              `No tracked characters for killmail ${partial.killmail_id} - keeping as partial`
            );
            continue;
          }

          // Build full killmail data for transaction
          const killmailData = {
            killmailId: BigInt(partial.killmail_id),
            killTime: new Date(esiResult.killmail_time),
            npc: attackers.every((a) => !a.characterId),
            solo: attackers.length === 1,
            awox: false, // TODO: implement awox logic
            shipTypeId: esiResult.victim.ship_type_id,
            systemId: esiResult.solar_system_id,
            labels: killData.zkb.labels ?? [],
            totalValue: BigInt(Math.round(killData.zkb.totalValue)),
            points: killData.zkb.points,
            attackers: attackers.map((a) => ({
              characterId: a.characterId,
              corporationId: a.corporationId,
              allianceId: a.allianceId,
              damageDone: a.damageDone,
              finalBlow: a.finalBlow,
              securityStatus: a.securityStatus,
              shipTypeId: a.shipTypeId,
              weaponTypeId: a.weaponTypeId,
            })),
            victim: {
              characterId: victim.characterId,
              corporationId: victim.corporationId,
              allianceId: victim.allianceId,
              shipTypeId: victim.shipTypeId,
              damageTaken: victim.damageTaken,
            },
          };

          // Enrich with full data
          await this.killRepository.ingestKillTransaction(killmailData);

          stats.enriched++;
          logger.debug(
            `Enriched killmail ${partial.killmail_id} with full ESI data`
          );
        } catch (error: any) {
          stats.failed++;
          const errorMsg = `Failed to enrich killmail ${partial.killmail_id}: ${error.message}`;
          stats.errors.push(errorMsg);
          logger.warn(errorMsg);
        }
      }

      logger.info(
        `Enrichment completed: ${stats.enriched} enriched, ${stats.failed} failed out of ${stats.processed} processed`
      );

      return stats;
    } catch (error: any) {
      logger.error(`Error during killmail enrichment batch: ${error.message}`, {
        error,
      });
      stats.errors.push(`Batch error: ${error.message}`);
      return stats;
    }
  }
}
