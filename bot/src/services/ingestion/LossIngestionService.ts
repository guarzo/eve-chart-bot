import { ZkillClient } from "../../infrastructure/http/ZkillClient";
import { ESIService } from "../ESIService";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";
import { LossRepository } from "../../infrastructure/repositories/LossRepository";
import { LossFact } from "../../domain/killmail/LossFact";
import { logger } from "../../lib/logger";
import { BaseIngestionService, IngestionConfig } from "./BaseIngestionService";

/**
 * Service for ingesting loss data from zKillboard and ESI
 */
export class LossIngestionService extends BaseIngestionService {
  private readonly zkill: ZkillClient;
  private readonly esiService: ESIService;
  private readonly characterRepository: CharacterRepository;
  private readonly lossRepository: LossRepository;

  constructor(
    zkillApiUrl: string = "https://zkillboard.com/api",
    config: Partial<IngestionConfig> = {}
  ) {
    super(config);
    this.zkill = new ZkillClient(zkillApiUrl);
    this.esiService = new ESIService();
    this.characterRepository = new CharacterRepository();
    this.lossRepository = new LossRepository();
  }

  /**
   * Ingest a single loss killmail
   */
  public async ingestLoss(
    killId: number,
    characterId: bigint
  ): Promise<{
    success: boolean;
    skipped?: boolean;
    existing?: boolean;
    timestamp?: string;
    age?: number;
    error?: string;
  }> {
    try {
      // 1) Skip if already in DB - killmails are immutable
      const existingLoss = await this.lossRepository.getLoss(BigInt(killId));
      if (existingLoss) {
        logger.debug(`Skipping loss ${killId}, already processed`);
        return { success: false, existing: true, skipped: true };
      }

      // 2) Fetch from zKillboard with retry
      const zk = await this.retryZkill(
        () => this.zkill.getKillmail(killId),
        `Fetching zKill data for loss ${killId}`
      );
      if (!zk) {
        logger.warn(`No zKill data for loss ${killId}`);
        return { success: false, skipped: true };
      }

      // 3) Fetch from ESI with retry
      const esi = await this.retryEsi(
        () => this.esiService.getKillmail(zk.killmail_id, zk.zkb.hash),
        `Fetching ESI data for loss ${killId}`
      );
      if (!esi?.victim) {
        logger.warn(`Invalid ESI data for loss ${killId}`);
        return { success: false, skipped: true };
      }

      // 4) Verify this is a loss for the specified character
      if (esi.victim.character_id !== characterId.toString()) {
        logger.debug(
          `Skipping loss ${killId} - victim is not character ${characterId}`
        );
        return { success: false, skipped: true };
      }

      // 5) Create and save loss fact
      const loss = new LossFact({
        killmailId: BigInt(killId),
        characterId: characterId,
        killTime: new Date(esi.killmail_time),
        shipTypeId: esi.victim.ship_type_id,
        systemId: esi.solar_system_id,
        totalValue: BigInt(Math.round(zk.zkb.totalValue)),
        attackerCount: esi.attackers.length,
        labels: zk.zkb.labels ?? [],
      });

      await this.lossRepository.saveLoss(loss);

      return {
        success: true,
        timestamp: esi.killmail_time,
        age: Math.floor(
          (Date.now() - new Date(esi.killmail_time).getTime()) / 1000 / 60 / 60
        ),
      };
    } catch (error: any) {
      logger.error(`Error ingesting loss ${killId}: ${error.message}`);
      return { success: false, error: error.message };
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

          // Fetch losses from zKillboard
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

          // Process losses in batches
          const results = await this.processBatch(
            losses,
            async (loss) => {
              if (!loss || !loss.killmail_id || !loss.zkb) {
                logger.debug("Invalid loss data:", {
                  loss,
                  hasKillmailId: !!loss?.killmail_id,
                  hasZkb: !!loss?.zkb,
                });
                return null;
              }

              const killId = loss.killmail_id;
              logger.debug(`Processing loss ${killId}`);

              if (killId <= lastProcessedId) {
                logger.info(
                  `Reached previously processed loss ${killId}, stopping`
                );
                hasMore = false;
                return null;
              }

              // Check loss age
              const lossTime = new Date(loss.killmail_time);
              if (lossTime < cutoffDate) {
                logger.info(
                  `Reached loss older than cutoff date (${cutoffDate.toISOString()}), stopping`
                );
                tooOldCount++;
                hasMore = false;
                return null;
              }

              return await this.ingestLoss(killId, characterId);
            },
            `Processing losses for character ${characterId}`
          );

          // Process results
          for (const result of results) {
            if (!result) continue;

            if (result.success) {
              successfulIngestCount++;
            } else if (result.skipped) {
              if (result.existing) {
                duplicateCount++;
              } else {
                skippedCount++;
              }
            } else if (result.error) {
              errorCount++;
            }
            totalLossmailsProcessed++;
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
        `Completed backfill for character ${characterId} in ${duration}ms: ${successfulIngestCount} ingested, ${duplicateCount} duplicates, ${skippedCount} other skipped, ${errorCount} errors, ${tooOldCount} too old, ${totalLossmailsProcessed} total processed`
      );
    } catch (error: any) {
      logger.error(
        `Error backfilling losses for character ${characterId}:`,
        error
      );
      throw error;
    }
  }
}
