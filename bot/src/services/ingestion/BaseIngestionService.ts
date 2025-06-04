import { retryOperation, CircuitBreaker } from "../../utils/retry";
import { logger } from "../../lib/logger";

export interface IngestionConfig {
  maxRetries: number;
  initialRetryDelay: number;
  zkillTimeout: number;
  esiTimeout: number;
  batchSize: number;
  circuitBreakerThreshold: number;
  circuitBreakerCooldown: number;
}

export const DEFAULT_INGESTION_CONFIG: IngestionConfig = {
  maxRetries: 3,
  initialRetryDelay: 5000,
  zkillTimeout: 15000,
  esiTimeout: 30000,
  batchSize: 5,
  circuitBreakerThreshold: 3,
  circuitBreakerCooldown: 30000,
};

export abstract class BaseIngestionService {
  protected readonly esiCircuitBreaker: CircuitBreaker;
  protected readonly zkillCircuitBreaker: CircuitBreaker;
  protected readonly config: IngestionConfig;

  constructor(config: Partial<IngestionConfig> = {}) {
    this.config = { ...DEFAULT_INGESTION_CONFIG, ...config };
    this.esiCircuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerCooldown,
      "ESI Service"
    );
    this.zkillCircuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerCooldown,
      "zKillboard Service"
    );
  }

  protected async retryZkill<T>(
    operation: () => Promise<T>,
    description: string
  ): Promise<T | null> {
    return this.zkillCircuitBreaker.execute(async () => {
      return retryOperation(operation, description, {
        maxRetries: this.config.maxRetries,
        initialRetryDelay: this.config.initialRetryDelay,
        timeout: this.config.zkillTimeout,
      });
    });
  }

  protected async retryEsi<T>(
    operation: () => Promise<T>,
    description: string
  ): Promise<T | null> {
    return this.esiCircuitBreaker.execute(async () => {
      return retryOperation(operation, description, {
        maxRetries: this.config.maxRetries,
        initialRetryDelay: this.config.initialRetryDelay,
        timeout: this.config.esiTimeout,
      });
    });
  }

  protected async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R | null>,
    description: string
  ): Promise<R[]> {
    const results: R[] = [];
    const batchSize = this.config.batchSize;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      logger.debug(
        `${description} batch ${i / batchSize + 1}/${Math.ceil(
          items.length / batchSize
        )}`
      );

      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            return await processor(item);
          } catch (error: any) {
            logger.error(`Error processing item in batch: ${error.message}`, {
              error,
              item,
            });
            return null;
          }
        })
      );

      for (const result of batchResults) {
        if (result !== null) {
          results.push(result);
        }
      }
    }

    return results;
  }

  protected isBackfillOperation(): boolean {
    const stack = new Error().stack || "";
    return stack.includes("backfill");
  }

  public getCircuitBreakerStates(): {
    esi: { state: string; failureCount: number; nextAttemptTime: number };
    zkill: { state: string; failureCount: number; nextAttemptTime: number };
  } {
    return {
      esi: this.esiCircuitBreaker.getState(),
      zkill: this.zkillCircuitBreaker.getState(),
    };
  }

  public resetCircuitBreakers(): void {
    this.esiCircuitBreaker.reset();
    this.zkillCircuitBreaker.reset();
    logger.info("All circuit breakers have been reset");
  }
}
