import { logger } from "../lib/logger";

interface RetryOptions {
  maxRetries?: number;
  initialRetryDelay?: number;
  maxRetryDelay?: number;
  timeout?: number;
  backoffFactor?: number;
}

/**
 * Retry an operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  description: string,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialRetryDelay = 5000,
    maxRetryDelay = 30000,
    timeout = 15000,
    backoffFactor = 2,
  } = options;

  let lastError: Error | null = null;
  let currentDelay = initialRetryDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeout}ms`));
        }, timeout);
      });

      // Race the operation against the timeout
      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } catch (error: any) {
      lastError = error;
      const isTimeout = error.message.includes("timed out");
      const isRateLimit =
        error.message.includes("rate limit") || error.message.includes("429");

      // Log the error with appropriate context
      if (isTimeout) {
        logger.error(`ZKillboard request timeout:`);
      } else if (isRateLimit) {
        logger.error(`ZKillboard rate limit hit:`);
      }

      if (attempt < maxRetries) {
        // Calculate next delay with exponential backoff
        currentDelay = Math.min(currentDelay * backoffFactor, maxRetryDelay);

        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 1000;
        const delayWithJitter = currentDelay + jitter;

        logger.info(
          `Retrying ${description} (attempt ${
            attempt + 1
          }/${maxRetries}) - Last error: ${
            error.message
          } - Waiting ${Math.round(delayWithJitter / 1000)}s`
        );

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delayWithJitter));
      }
    }
  }

  throw new Error(
    `${description} failed after ${maxRetries} attempts: ${lastError?.message}`
  );
}

/**
 * Rate limit helper for API clients
 */
export class RateLimiter {
  private lastRequestTime: number = 0;

  constructor(private readonly minDelayMs: number) {}

  /**
   * Wait if necessary to respect rate limits
   */
  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      const delay = this.minDelayMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    this.lastRequestTime = Date.now();
  }
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private failureCount = 0;
  private nextAttemptTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private readonly maxFailuresBeforeOpen: number = 3,
    private readonly cooldownPeriodMs: number = 30000, // 30 seconds
    private readonly serviceName: string = "Unknown Service"
  ) {}

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(
          `Circuit breaker OPEN for ${
            this.serviceName
          }: cooling down until ${new Date(this.nextAttemptTime).toISOString()}`
        );
      } else {
        // Transition to HALF_OPEN to test if service is back
        this.state = "HALF_OPEN";
        logger.info(
          `Circuit breaker for ${this.serviceName} transitioning to HALF_OPEN for test`
        );
      }
    }

    try {
      const result = await operation();

      // Success - reset failure count and close circuit if needed
      if (this.state === "HALF_OPEN") {
        logger.info(
          `Circuit breaker for ${this.serviceName} test successful, transitioning to CLOSED`
        );
        this.state = "CLOSED";
      }

      this.failureCount = 0;
      return result;
    } catch (error) {
      this.failureCount++;

      logger.warn(
        `Circuit breaker for ${this.serviceName} recorded failure ${this.failureCount}/${this.maxFailuresBeforeOpen}`,
        {
          error: error instanceof Error ? error.message : String(error),
          currentState: this.state,
        }
      );

      if (
        this.failureCount >= this.maxFailuresBeforeOpen ||
        this.state === "HALF_OPEN"
      ) {
        // Open the circuit
        this.state = "OPEN";
        this.nextAttemptTime = Date.now() + this.cooldownPeriodMs;

        logger.error(
          `Circuit breaker for ${this.serviceName} OPENED due to ${
            this.failureCount
          } failures. Will attempt retry at ${new Date(
            this.nextAttemptTime
          ).toISOString()}`
        );
      }

      throw error;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): { state: string; failureCount: number; nextAttemptTime: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.nextAttemptTime = 0;
    logger.info(`Circuit breaker for ${this.serviceName} manually reset`);
  }
}
