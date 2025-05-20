import Redis from "ioredis";
import { KillmailIngestionService } from "./KillmailIngestionService";
import { logger } from "../../lib/logger";
import { CircuitBreaker } from "../../lib/circuit-breaker/CircuitBreaker";
import { retryOperation } from "../../utils/retry";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";

interface RedisQKillmail {
  killID: number;
  hash: string;
  package: {
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
    zkb?: {
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
  };
}

export class RedisQService {
  private redis: Redis;
  private killmailService: KillmailIngestionService;
  private characterRepository: CharacterRepository;
  private circuitBreaker: CircuitBreaker;
  private isRunning = false;
  private refreshInterval: NodeJS.Timeout | null = null;
  private metrics = {
    processedKillmails: 0,
    failedKillmails: 0,
    skippedKillmails: 0,
    lastProcessedId: 0,
    lastProcessedTime: new Date(),
  };

  constructor(
    redisUrl: string,
    circuitBreakerThreshold: number = 5,
    circuitBreakerTimeout: number = 30000
  ) {
    this.redis = new Redis(redisUrl);
    this.killmailService = new KillmailIngestionService();
    this.characterRepository = new CharacterRepository();
    this.circuitBreaker = new CircuitBreaker(
      circuitBreakerThreshold,
      circuitBreakerTimeout
    );
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

    await this.redis.quit();
    await this.killmailService.close();
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
      // Check if circuit breaker is open
      if (this.circuitBreaker.isOpen()) {
        logger.warn("Circuit breaker is open, skipping killmail processing");
        this.metrics.skippedKillmails++;
        return;
      }

      // Process the killmail
      const result = await retryOperation(
        () => this.killmailService.ingestKillmail(killmail.killID),
        `Processing killmail ${killmail.killID}`,
        {
          maxRetries: 3,
          initialRetryDelay: 5000,
          timeout: 30000,
        }
      );

      if (!result) {
        logger.warn(`No result returned for killmail ${killmail.killID}`);
        this.metrics.skippedKillmails++;
        return;
      }

      if (result.success) {
        this.metrics.processedKillmails++;
        this.metrics.lastProcessedId = killmail.killID;
        this.metrics.lastProcessedTime = new Date();
        this.circuitBreaker.onSuccess();
      } else {
        this.metrics.skippedKillmails++;
        if (result.error) {
          logger.warn(
            `Failed to process killmail ${killmail.killID}: ${result.error}`
          );
          this.circuitBreaker.onFailure();
        }
      }
    } catch (error) {
      this.metrics.failedKillmails++;
      this.circuitBreaker.onFailure();
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
   * Poll RedisQ for new killmails
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const response = await retryOperation(
        () =>
          fetch(
            "https://redisq.zkillboard.com/listen.php?queueID=eve-chart-bot"
          ),
        "Polling RedisQ",
        {
          maxRetries: 3,
          initialRetryDelay: 5000,
          timeout: 30000,
        }
      );

      if (!response) {
        logger.warn("No response from RedisQ");
        setTimeout(() => this.poll(), 5000);
        return;
      }

      const data = await response.json();
      if (data && data.package) {
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
