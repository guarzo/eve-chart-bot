import { logger } from "../../lib/logger";
import { KillmailIngestionService } from "./KillmailIngestionService";

/**
 * Service responsible for periodically enriching partial killmails with full ESI data
 */
export class KillmailEnrichmentService {
  private killmailIngestionService: KillmailIngestionService;
  private isRunning = false;
  private enrichmentInterval: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private readonly batchSize: number;

  constructor(intervalMinutes: number = 15, batchSize: number = 50) {
    this.killmailIngestionService = new KillmailIngestionService();
    this.intervalMs = intervalMinutes * 60 * 1000; // Convert to milliseconds
    this.batchSize = batchSize;
  }

  /**
   * Start the enrichment service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Killmail enrichment service is already running");
      return;
    }

    this.isRunning = true;
    logger.info(
      `Starting killmail enrichment service - running every ${
        this.intervalMs / 60000
      } minutes with batch size ${this.batchSize}`
    );

    // Run immediately on start
    await this.runEnrichmentBatch();

    // Schedule periodic enrichment
    this.enrichmentInterval = setInterval(async () => {
      try {
        await this.runEnrichmentBatch();
      } catch (error) {
        logger.error("Error during scheduled enrichment batch:", error);
      }
    }, this.intervalMs);

    logger.info("Killmail enrichment service started successfully");
  }

  /**
   * Stop the enrichment service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn("Killmail enrichment service is not running");
      return;
    }

    this.isRunning = false;
    logger.info("Stopping killmail enrichment service...");

    if (this.enrichmentInterval) {
      clearInterval(this.enrichmentInterval);
      this.enrichmentInterval = null;
    }

    logger.info("Killmail enrichment service stopped");
  }

  /**
   * Run a single enrichment batch
   */
  private async runEnrichmentBatch(): Promise<void> {
    try {
      logger.debug("Starting enrichment batch...");

      const startTime = Date.now();
      const result = await this.killmailIngestionService.enrichPartialKillmails(
        this.batchSize
      );
      const duration = Date.now() - startTime;

      if (result.processed > 0) {
        logger.info(
          `Enrichment batch completed in ${duration}ms: ${result.enriched} enriched, ${result.failed} failed, ${result.processed} total processed`
        );

        if (result.errors.length > 0) {
          logger.warn(
            `Enrichment errors (showing first 5):`,
            result.errors.slice(0, 5)
          );
        }
      } else {
        logger.debug("No partial killmails found to enrich");
      }
    } catch (error) {
      logger.error("Error running enrichment batch:", error);
    }
  }

  /**
   * Manually trigger an enrichment batch (for admin/testing purposes)
   */
  async runManualEnrichment(batchSize?: number): Promise<{
    processed: number;
    enriched: number;
    failed: number;
    errors: string[];
  }> {
    logger.info(
      `Running manual enrichment with batch size ${batchSize || this.batchSize}`
    );

    const result = await this.killmailIngestionService.enrichPartialKillmails(
      batchSize || this.batchSize
    );

    logger.info(
      `Manual enrichment completed: ${result.enriched} enriched, ${result.failed} failed, ${result.processed} total processed`
    );

    return result;
  }

  /**
   * Get enrichment service status
   */
  getStatus(): {
    isRunning: boolean;
    intervalMinutes: number;
    batchSize: number;
    circuitBreakerStates: {
      esi: { state: string; failureCount: number; nextAttemptTime: number };
      zkill: { state: string; failureCount: number; nextAttemptTime: number };
    };
  } {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.intervalMs / 60000,
      batchSize: this.batchSize,
      circuitBreakerStates:
        this.killmailIngestionService.getCircuitBreakerStates(),
    };
  }

  /**
   * Reset circuit breakers (for admin purposes)
   */
  resetCircuitBreakers(): void {
    this.killmailIngestionService.resetCircuitBreakers();
    logger.info("Circuit breakers reset via enrichment service");
  }
}
