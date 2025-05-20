import { logger } from "../lib/logger";

export interface RetryConfig {
  maxRetries?: number;
  initialRetryDelay?: number;
  maxRetryDelay?: number;
  timeout?: number;
  shouldRetry?: (error: any) => boolean;
}

export const defaultRetryConfig: Required<RetryConfig> = {
  maxRetries: 3,
  initialRetryDelay: 1000,
  maxRetryDelay: 30000,
  timeout: 30000,
  shouldRetry: (error: any) => {
    if (!(error instanceof Error)) return false;
    return (
      error.message.includes("429") || // Rate limit
      error.message.includes("503") || // Service unavailable
      error.message.includes("504") || // Gateway timeout
      error.message.includes("ECONNRESET") || // Connection reset
      error.message.includes("ETIMEDOUT") // Connection timeout
    );
  },
};

/**
 * Retry an operation with exponential backoff and timeout
 * @param operation The operation to retry
 * @param operationName Name of the operation for logging
 * @param config Retry configuration
 * @returns The result of the operation, or undefined if all retries failed
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  config: RetryConfig = {}
): Promise<T | undefined> {
  const finalConfig = { ...defaultRetryConfig, ...config };
  let retryCount = 0;

  while (retryCount < finalConfig.maxRetries) {
    try {
      logger.info(
        `${operationName} (attempt ${retryCount + 1}/${finalConfig.maxRetries})`
      );

      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(`Operation timed out after ${finalConfig.timeout}ms`)
            ),
          finalConfig.timeout
        );
      });

      // Race the operation against the timeout
      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } catch (error: any) {
      retryCount++;

      // Format a simple human-readable error message
      const status = error.response?.status;
      const url = error.config?.url;
      const errorMsg = error.message || "Unknown error";

      if (
        retryCount >= finalConfig.maxRetries ||
        !finalConfig.shouldRetry(error)
      ) {
        logger.error(
          `${operationName} failed after ${retryCount} attempts: ${errorMsg}${
            status ? ` (${status})` : ""
          }${url ? ` - ${url}` : ""}`
        );
        return undefined;
      }

      // Calculate exponential backoff delay with jitter
      const baseDelay =
        finalConfig.initialRetryDelay * Math.pow(2, retryCount - 1);
      const jitter = Math.random() * 0.1 * baseDelay; // Add up to 10% jitter
      const delay = Math.min(baseDelay + jitter, finalConfig.maxRetryDelay);

      logger.warn(
        `${operationName} failed (attempt ${retryCount}/${
          finalConfig.maxRetries
        }): ${errorMsg}${status ? ` (${status})` : ""}${
          url ? ` - ${url}` : ""
        }. Retrying in ${Math.round(delay / 1000)}s...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return undefined;
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
