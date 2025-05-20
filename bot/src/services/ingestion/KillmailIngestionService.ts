import { KillRepository } from "../../infrastructure/repositories/KillRepository";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";
import { ESIService } from "../ESIService";
import { RetryService } from "./RetryService";
import { logger } from "../../lib/logger";
import {
  Killmail,
  KillmailAttacker,
  KillmailVictim,
} from "../../domain/killmail/Killmail";

import { ZkillClient } from "../../lib/api/ZkillClient";

// ——— Helpers ———
/** Safely coerce numbers/strings to BigInt, or return null */
const toBigInt = (val?: number | string | null): bigint | null =>
  val == null ? null : BigInt(typeof val === "string" ? val : Math.trunc(val));

export class KillmailIngestionService {
  private readonly killRepository: KillRepository;
  private readonly characterRepository: CharacterRepository;
  private readonly esiService: ESIService;
  private readonly retryService: RetryService;
  private readonly zkill: ZkillClient;

  constructor(
    zkillApiUrl: string = "https://zkillboard.com/api",
    maxRetries: number = 3,
    retryDelay: number = 5000
  ) {
    this.killRepository = new KillRepository();
    this.characterRepository = new CharacterRepository();
    this.esiService = new ESIService();
    this.retryService = new RetryService(maxRetries, retryDelay);
    this.zkill = new ZkillClient(zkillApiUrl);
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
      const existingKillmail = await this.killRepository.getKillmail(
        killId.toString()
      );
      if (existingKillmail) {
        logger.debug(`Skipping killmail ${killId}, already processed`);
        return { success: false, existing: true, skipped: true };
      }

      // 2) Fetch from zKillboard with retry (15s timeout for zKill)
      const zk = await this.retryService.retryOperation(
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
      const esi = await this.retryService.retryOperation(
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
      if (tracked.length === 0) {
        logger.debug(`No tracked characters in killmail ${killId}`);
        return { success: false, skipped: true };
      }

      const killmail = new Killmail({
        killmailId: BigInt(killId),
        killTime: new Date(esi.killmail_time),
        systemId: esi.solar_system_id,
        totalValue: BigInt(Math.round(zk.zkb.totalValue)),
        points: zk.zkb.points,
        npc: attackers.every((a) => !a.characterId), // NPC kill if no player attackers
        solo: attackers.length === 1,
        awox: false,
        shipTypeId: esi.victim.ship_type_id,
        labels: zk.zkb.labels ?? [],
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
      logger.error(`Error ingesting killmail ${killId}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Backfill kills for a character
   */
  public async backfillKills(characterId: bigint): Promise<void> {
    try {
      logger.info(`Backfilling kills for character ${characterId}`);

      // Get character from repository
      const character = await this.characterRepository.getCharacter(
        characterId.toString()
      );
      if (!character) {
        throw new Error(`Character ${characterId} not found`);
      }

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

      while (hasMore) {
        try {
          // Fetch killmails from zKillboard
          const killmails = await this.retryService.retryOperation(
            () => this.zkill.getCharacterKills(Number(characterId), page),
            `Fetching killmails for character ${characterId} page ${page}`,
            3, // maxRetries
            5000, // retryDelay
            30000 // timeout
          );

          if (!killmails || killmails.length === 0) {
            logger.info(
              `No more killmails found for character ${characterId} on page ${page}`
            );
            hasMore = false;
            continue;
          }

          logger.info(
            `Processing ${killmails.length} killmails for character ${characterId} on page ${page}`
          );

          let pageProcessedCount = 0;
          let pageSkippedCount = 0;

          // Process each killmail
          for (const killmail of killmails) {
            try {
              const recordId = BigInt(killmail.killmail_id);
              if (recordId <= lastProcessedId) {
                hasMore = false;
                break;
              }

              const result = await this.ingestKillmail(killmail.killmail_id);
              if (result.success) {
                successfulIngestCount++;
                pageProcessedCount++;
                lastProcessedId = recordId;
              } else {
                pageSkippedCount++;
                skippedCount++;
                if (result.error) {
                  logger.warn(
                    `Failed to ingest killmail ${killmail.killmail_id}: ${result.error}`
                  );
                }
              }
            } catch (error) {
              logger.error(
                {
                  error,
                  killmailId: killmail.killmail_id,
                  errorMessage:
                    error instanceof Error ? error.message : String(error),
                  errorStack: error instanceof Error ? error.stack : undefined,
                },
                `Error processing individual killmail ${killmail.killmail_id}`
              );
              pageSkippedCount++;
              skippedCount++;
            }
          }

          logger.info(
            `Page ${page} complete - Processed: ${pageProcessedCount}, Skipped: ${pageSkippedCount}, ` +
              `Total processed: ${successfulIngestCount}, Total skipped: ${skippedCount}`
          );

          page++;
        } catch (error) {
          logger.error(
            `Error processing page ${page} for character ${characterId}:`,
            error
          );
          hasMore = false;
        }
      }

      // Update checkpoint
      await this.characterRepository.updateIngestionCheckpoint(
        "kills",
        characterId,
        lastProcessedId
      );

      logger.info(
        `Backfill complete for character ${characterId} - Processed: ${successfulIngestCount}, Skipped: ${skippedCount}`
      );
    } catch (error) {
      logger.error(
        `Error backfilling kills for character ${characterId}:`,
        error
      );
      throw error;
    }
  }

  public async backfillLosses(
    characterId: bigint,
    maxAgeDays = 30
  ): Promise<void> {
    // Implementation will be moved from IngestionService
    logger.info(
      `Backfilling losses for character ${characterId} (max age: ${maxAgeDays} days)`
    );
  }

  public async close(): Promise<void> {
    // No resources to clean up at the moment
  }
}
