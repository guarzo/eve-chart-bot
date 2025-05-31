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
