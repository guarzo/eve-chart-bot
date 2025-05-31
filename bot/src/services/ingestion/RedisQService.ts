import Redis from "ioredis";
import { logger } from "../../lib/logger";
import { retryOperation } from "../../utils/retry";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";
import { ESIService } from "../ESIService";
import {
  Killmail,
  KillmailAttacker,
  KillmailVictim,
} from "../../domain/killmail/Killmail";
import { KillRepository } from "../../infrastructure/repositories/KillRepository";

interface RedisQKillmail {
  killID: number;
  killmail_time: string;
  solar_system_id: number;
  victim: {
    character_id?: number;
    corporation_id?: number;
    alliance_id?: number;
    ship_type_id: number;
    damage_taken: number;
    position: { x: number; y: number; z: number };
    items: Array<{
      type_id: number;
      flag: number;
      quantity_destroyed?: number;
      quantity_dropped?: number;
      singleton: number;
    }>;
  };
  attackers: Array<{
    character_id?: number;
    corporation_id?: number;
    alliance_id?: number;
    damage_done: number;
    final_blow: boolean;
    security_status: number;
    ship_type_id: number;
    weapon_type_id: number;
  }>;
  zkb: {
    locationID: number;
    hash: string;
    fittedValue: number;
    droppedValue: number;
    destroyedValue: number;
    totalValue: number;
    points: number;
    npc: boolean;
    solo: boolean;
    awox: boolean;
  };
}

export class RedisQService {
  private redis: Redis;
  private characterRepository: CharacterRepository;
  private killRepository: KillRepository;
  private esiService: ESIService;
  private isRunning = false;
  private refreshInterval: NodeJS.Timeout | null = null;
  private loggingInterval: NodeJS.Timeout | null = null;
  private periodMetrics = {
    receivedKillmails: 0,
    lastLogTime: new Date(),
  };
  private metrics = {
    processedKillmails: 0,
    failedKillmails: 0,
    skippedKillmails: 0,
    lastProcessedId: 0,
    lastProcessedTime: new Date(),
  };

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.characterRepository = new CharacterRepository();
    this.killRepository = new KillRepository();
    this.esiService = new ESIService();
  }

  /**
   * Start the RedisQ consumer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("RedisQ consumer is already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting RedisQ consumer...");

    // Start periodic refresh of tracked characters
    this.refreshInterval = setInterval(
      () => this.refreshTrackedCharacters(),
      5 * 60 * 1000 // Refresh every 5 minutes
    );

    // Start periodic logging of RedisQ activity
    this.loggingInterval = setInterval(
      () => this.logPeriodicMetrics(),
      60 * 1000 // Log every minute
    );

    // Initial refresh
    await this.refreshTrackedCharacters();

    // Start polling
    await this.poll();
  }

  /**
   * Stop the RedisQ consumer
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn("RedisQ consumer is not running");
      return;
    }

    this.isRunning = false;
    logger.info("Stopping RedisQ consumer...");

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.loggingInterval) {
      clearInterval(this.loggingInterval);
      this.loggingInterval = null;
    }

    await this.redis.quit();
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: this.isRunning
        ? Date.now() - this.metrics.lastProcessedTime.getTime()
        : 0,
    };
  }

  /**
   * Process a killmail from RedisQ
   */
  private async processKillmail(killmail: RedisQKillmail): Promise<void> {
    try {
      // Get the killmail data from the package
      const killID = killmail.killID;
      const zkb = killmail.zkb;
      if (!killID || !zkb?.hash) {
        this.metrics.skippedKillmails++;
        return;
      }

      // Get all tracked characters
      const trackedCharacters =
        await this.characterRepository.getAllCharacters();
      const trackedCharacterIds = new Set(
        trackedCharacters.map((c) => c.eveId.toString())
      );

      // Check if any tracked character is involved
      const victimId = killmail.victim?.character_id?.toString();
      const attackerIds =
        killmail.attackers
          ?.map((a: { character_id?: number }) => a.character_id?.toString())
          .filter((id: string | undefined): id is string => id !== undefined) ||
        [];

      const isVictimTracked = victimId && trackedCharacterIds.has(victimId);
      const trackedAttackers = attackerIds.filter((id: string) =>
        trackedCharacterIds.has(id)
      );

      if (!isVictimTracked && trackedAttackers.length === 0) {
        this.metrics.skippedKillmails++;
        logger.debug(
          `Skipped killmail ${killID} - no tracked characters involved`
        );
        return;
      }

      // Process the killmail using ESI directly
      const result = await retryOperation(
        () => this.esiService.getKillmail(killID, zkb.hash),
        `Processing killmail ${killID}`,
        {
          maxRetries: 3,
          initialRetryDelay: 5000,
          timeout: 30000,
        }
      );

      if (!result) {
        this.metrics.skippedKillmails++;
        return;
      }

      // Create domain entities
      const victim = new KillmailVictim({
        characterId: killmail.victim?.character_id
          ? BigInt(killmail.victim.character_id)
          : undefined,
        corporationId: killmail.victim?.corporation_id
          ? BigInt(killmail.victim.corporation_id)
          : undefined,
        allianceId: killmail.victim?.alliance_id
          ? BigInt(killmail.victim.alliance_id)
          : undefined,
        shipTypeId: killmail.victim?.ship_type_id,
        damageTaken: killmail.victim?.damage_taken,
      });

      const attackers = (killmail.attackers || []).map(
        (a: {
          character_id?: number;
          corporation_id?: number;
          alliance_id?: number;
          damage_done: number;
          final_blow: boolean;
          security_status: number;
          ship_type_id: number;
          weapon_type_id: number;
        }) =>
          new KillmailAttacker({
            characterId: a.character_id ? BigInt(a.character_id) : undefined,
            corporationId: a.corporation_id
              ? BigInt(a.corporation_id)
              : undefined,
            allianceId: a.alliance_id ? BigInt(a.alliance_id) : undefined,
            damageDone: a.damage_done,
            finalBlow: a.final_blow,
            securityStatus: a.security_status,
            shipTypeId: a.ship_type_id,
            weaponTypeId: a.weapon_type_id,
          })
      );

      // Create the killmail object
      const killmailData = new Killmail({
        killmailId: BigInt(killID),
        killTime: new Date(result.killmail_time),
        systemId: result.solar_system_id,
        totalValue: BigInt(Math.round(zkb.totalValue)),
        points: zkb.points,
        npc: zkb.npc,
        solo: zkb.solo,
        awox: zkb.awox,
        shipTypeId: result.victim.ship_type_id,
        labels: [], // zKill doesn't provide labels in the RedisQ package
        victim,
        attackers,
      });

      // Save the killmail
      await this.killRepository.saveKillmail(killmailData);
      logger.info(
        `Saved killmail ${killID} - Tracked victim: ${isVictimTracked}, Tracked attackers: ${trackedAttackers.length}`
      );

      this.metrics.processedKillmails++;
      this.metrics.lastProcessedId = killID;
      this.metrics.lastProcessedTime = new Date();
    } catch (error) {
      this.metrics.failedKillmails++;
      logger.error(
        {
          error,
          killmailId: killmail.killID,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        `Error processing killmail ${killmail.killID}`
      );
    }
  }

  /**
   * Refresh the list of tracked characters
   */
  public async refreshTrackedCharacters(): Promise<void> {
    try {
      // Get all characters from the repository
      const characters = await this.characterRepository.getAllCharacters();
      logger.info(`Refreshed ${characters.length} tracked characters`);
    } catch (error) {
      logger.error("Failed to refresh tracked characters:", error);
      throw error;
    }
  }

  /**
   * Log periodic metrics about RedisQ activity
   */
  private logPeriodicMetrics(): void {
    const now = new Date();
    const timeSinceLastLog =
      (now.getTime() - this.periodMetrics.lastLogTime.getTime()) / 1000;

    if (this.periodMetrics.receivedKillmails > 0) {
      logger.info(
        `RedisQ activity: ${
          this.periodMetrics.receivedKillmails
        } killmails received in last ${Math.round(timeSinceLastLog)}s`
      );
    } else {
      logger.debug("RedisQ activity: No killmails received in the last minute");
    }

    // Reset counters
    this.periodMetrics.receivedKillmails = 0;
    this.periodMetrics.lastLogTime = now;
  }

  /**
   * Poll RedisQ for new killmails
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const response = await retryOperation(
        () =>
          fetch(
            "https://zkillredisq.stream/listen.php?queueID=eve-chart-bot&ttw=10"
          ),
        "",
        {
          maxRetries: 3,
          initialRetryDelay: 5000,
          timeout: 30000,
        }
      );

      if (!response) {
        setTimeout(() => this.poll(), 5000);
        return;
      }

      const data = await response.json();

      if (data && data.package) {
        this.periodMetrics.receivedKillmails++;
        await this.processKillmail(data.package as RedisQKillmail);
      }

      // Continue polling
      setTimeout(() => this.poll(), 1000);
    } catch (error) {
      logger.error("Error polling RedisQ:", error);
      // Continue polling even after error
      setTimeout(() => this.poll(), 5000);
    }
  }
}
