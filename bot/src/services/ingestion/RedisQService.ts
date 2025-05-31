import Redis from "ioredis";
import { logger } from "../../lib/logger";
import { retryOperation, CircuitBreaker } from "../../utils/retry";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";
import { ESIService } from "../ESIService";
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
  private esiCircuitBreaker: CircuitBreaker;
  private isRunning = false;
  private refreshInterval: NodeJS.Timeout | null = null;
  private loggingInterval: NodeJS.Timeout | null = null;
  private trackedCharacterSet: Set<bigint> = new Set();
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
    this.esiCircuitBreaker = new CircuitBreaker(
      5,
      60000,
      "ESI Service (RedisQ)"
    ); // More tolerant for RedisQ
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
      circuitBreaker: this.esiCircuitBreaker.getState(),
    };
  }

  /**
   * Reset the ESI circuit breaker (for admin/debugging purposes)
   */
  resetCircuitBreaker(): void {
    this.esiCircuitBreaker.reset();
    logger.info("RedisQ ESI circuit breaker has been reset");
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

      // Check if any tracked character is involved using cached Set
      const victimId = killmail.victim?.character_id
        ? BigInt(killmail.victim.character_id)
        : null;

      const attackerIds =
        killmail.attackers
          ?.map((a) => (a.character_id ? BigInt(a.character_id) : null))
          .filter((id): id is bigint => id !== null) || [];

      const isVictimTracked =
        victimId && this.trackedCharacterSet.has(victimId);
      const trackedAttackers = attackerIds.filter((id) =>
        this.trackedCharacterSet.has(id)
      );

      if (!isVictimTracked && trackedAttackers.length === 0) {
        this.metrics.skippedKillmails++;
        logger.debug(
          `Skipped killmail ${killID} - no tracked characters involved`
        );
        return;
      }

      // Process the killmail using ESI with circuit breaker
      const result = await this.esiCircuitBreaker.execute(async () => {
        return await retryOperation(
          () => this.esiService.getKillmail(killID, zkb.hash),
          `Processing killmail ${killID}`,
          {
            maxRetries: 2, // Fewer retries since we have circuit breaker
            initialRetryDelay: 3000,
            timeout: 20000,
          }
        );
      });

      if (!result) {
        this.metrics.skippedKillmails++;
        logger.warn(`No ESI result for killmail ${killID}`);
        return;
      }

      // Build structured data for transactional ingestion
      const killmailData = {
        killmailId: BigInt(killID),
        killTime: new Date(result.killmail_time),
        npc: zkb.npc,
        solo: zkb.solo,
        awox: zkb.awox,
        shipTypeId: result.victim.ship_type_id,
        systemId: result.solar_system_id,
        labels: [], // zKill doesn't provide labels in the RedisQ package
        totalValue: BigInt(Math.round(zkb.totalValue)),
        points: zkb.points,
        attackers:
          killmail.attackers?.map((a) => ({
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
          })) || [],
        victim: {
          characterId: killmail.victim?.character_id
            ? BigInt(killmail.victim.character_id)
            : undefined,
          corporationId: killmail.victim?.corporation_id
            ? BigInt(killmail.victim.corporation_id)
            : undefined,
          allianceId: killmail.victim?.alliance_id
            ? BigInt(killmail.victim.alliance_id)
            : undefined,
          shipTypeId: killmail.victim?.ship_type_id || 0,
          damageTaken: killmail.victim?.damage_taken || 0,
        },
      };

      // Use transactional ingestion
      await this.killRepository.ingestKillTransaction(killmailData);

      logger.info(
        `Saved killmail ${killID} - Tracked victim: ${isVictimTracked}, Tracked attackers: ${trackedAttackers.length}`
      );

      this.metrics.processedKillmails++;
      this.metrics.lastProcessedId = killID;
      this.metrics.lastProcessedTime = new Date();
    } catch (error) {
      this.metrics.failedKillmails++;

      // Check if it's a circuit breaker error vs other error
      const isCircuitBreakerError =
        error instanceof Error &&
        error.message.includes("Circuit breaker OPEN");

      if (isCircuitBreakerError) {
        logger.warn(
          `Circuit breaker prevented processing killmail ${killmail.killID}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      } else {
        logger.error(
          {
            error,
            killmailId: killmail.killID,
            errorMessage:
              error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
          },
          `Error processing killmail ${killmail.killID}`
        );
      }
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
      this.trackedCharacterSet = new Set(
        characters.map((c) => BigInt(c.eveId))
      );
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
