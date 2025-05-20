import { ZkillClient } from "../../lib/api/ZkillClient";
import { ESIService } from "../ESIService";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";
import { LossRepository } from "../../infrastructure/repositories/LossRepository";
import { LossFact } from "../../domain/killmail/LossFact";
import { logger } from "../../lib/logger";
import { retryOperation } from "../../utils/retry";
import { CacheRedisAdapter } from "../../cache/CacheRedisAdapter";

/**
 * Service for ingesting loss data from zKillboard and ESI
 */
export class LossIngestionService {
  private readonly zkill: ZkillClient;
  private readonly esiService: ESIService;
  private readonly characterRepository: CharacterRepository;
  private readonly lossRepository: LossRepository;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    zkillApiUrl: string = "https://zkillboard.com/api",
    redisUrl: string = "redis://localhost:6379",
    cacheTtl: number = 300,
    maxRetries: number = 3,
    retryDelay: number = 5000
  ) {
    this.zkill = new ZkillClient(zkillApiUrl);
    this.esiService = new ESIService(new CacheRedisAdapter(redisUrl, cacheTtl));
    this.characterRepository = new CharacterRepository();
    this.lossRepository = new LossRepository();
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Ingest a single loss killmail
   * @param killId Killmail ID to ingest
   * @param characterId Character ID who lost the ship
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
      const zk = await retryOperation(
        () => this.zkill.getKillmail(killId),
        `Fetching zKill data for loss ${killId}`,
        {
          maxRetries: this.maxRetries,
          initialRetryDelay: this.retryDelay,
          timeout: 15000,
        }
      );
      if (!zk) {
        logger.warn(`No zKill data for loss ${killId}`);
        return { success: false, skipped: true };
      }

      // 3) Fetch from ESI with retry
      const esi = await retryOperation(
        () => this.esiService.getKillmail(zk.killmail_id, zk.zkb.hash),
        `Fetching ESI data for loss ${killId}`,
        {
          maxRetries: this.maxRetries,
          initialRetryDelay: this.retryDelay,
          timeout: 30000,
        }
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
   * @param characterId Character ID to backfill losses for
   * @param maxAgeDays Maximum age of losses to backfill in days
   */
  public async backfillLosses(
    characterId: bigint,
    maxAgeDays: number = 30
  ): Promise<void> {
    try {
      logger.info(
        `Backfilling losses for character ${characterId} (max age: ${maxAgeDays} days)`
      );

      // Get character info
      const character = await this.characterRepository.getCharacter(
        characterId.toString()
      );
      if (!character) {
        throw new Error(`Character ${characterId} not found`);
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - maxAgeDays);

      // Get losses from zKillboard
      const losses = await retryOperation(
        () => this.zkill.getCharacterLosses(Number(characterId)),
        `Fetching losses for character ${characterId}`,
        {
          maxRetries: this.maxRetries,
          initialRetryDelay: this.retryDelay,
          timeout: 30000,
        }
      );

      if (!losses || !Array.isArray(losses)) {
        logger.warn(`No losses found for character ${characterId}`);
        return;
      }

      // Filter losses by date range
      const filteredLosses = losses.filter((loss) => {
        const killTime = new Date(loss.killmail_time);
        return killTime >= startDate && killTime <= endDate;
      });

      logger.info(
        `Found ${filteredLosses.length} losses to process for character ${characterId}`
      );

      // Process each loss
      let successfulIngestCount = 0;
      let skippedCount = 0;

      for (const loss of filteredLosses) {
        try {
          const result = await this.ingestLoss(loss.killmail_id, characterId);
          if (result.success) {
            successfulIngestCount++;
          } else {
            skippedCount++;
          }
        } catch (error) {
          logger.error(
            `Error processing loss ${loss.killmail_id} for character ${characterId}:`,
            error
          );
          skippedCount++;
        }
      }

      logger.info(
        `Loss backfill complete for character ${characterId}: Processed ${successfulIngestCount}, Skipped ${skippedCount}`
      );
    } catch (error: any) {
      logger.error(
        `Error backfilling losses for character ${characterId}: ${error.message}`
      );
      throw error;
    }
  }
}
