import { logger } from "../../lib/logger";

/**
 * Configuration options for retry logic
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base delay in milliseconds between retries */
  baseDelayMs?: number;
  /** Whether to use exponential backoff (true) or constant delay (false) */
  useExponentialBackoff?: boolean;
  /** Custom error handler function */
  onError?: (error: Error, attempt: number) => void;
  /** Predicate to determine if an error should trigger a retry */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Retry a function with configurable backoff strategy
 * @param fn The function to retry
 * @param options Retry configuration options
 * @returns A Promise that resolves with the result of the function or rejects after max retries
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    useExponentialBackoff = true,
    onError = (error, attempt) => {
      logger.warn(
        `Retry attempt ${attempt}/${maxRetries} failed: ${error.message}`
      );
    },
    shouldRetry = () => true,
  } = options;

  let attempt = 0;

  async function attemptWithRetry(): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (!shouldRetry(err)) {
        logger.error(`Error not eligible for retry: ${err.message}`);
        throw err;
      }

      // Check if we've exceeded max retries
      if (attempt >= maxRetries) {
        logger.error(`Max retries (${maxRetries}) exceeded: ${err.message}`);
        throw err;
      }

      // Call error handler
      onError(err, attempt);

      // Calculate delay using exponential backoff if enabled
      const delay = useExponentialBackoff
        ? baseDelayMs * Math.pow(2, attempt - 1)
        : baseDelayMs;

      logger.debug(`Waiting ${delay}ms before retry attempt ${attempt + 1}`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Recursive retry
      return attemptWithRetry();
    }
  }

  return attemptWithRetry();
}

/**
 * Convenience wrapper for common retry patterns
 */
export const retryStrategies = {
  /**
   * HTTP request retry with exponential backoff
   * Retries on network errors and 5xx responses
   */
  http: (fn: () => Promise<any>, maxRetries = 3): Promise<any> =>
    retry(fn, {
      maxRetries,
      baseDelayMs: 1000,
      useExponentialBackoff: true,
      shouldRetry: (error) => {
        // Retry on network errors or server errors (5xx)
        const isNetworkError =
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ETIMEDOUT") ||
          error.message.includes("ENOTFOUND");
        const isServerError =
          error.message.includes("500") ||
          error.message.includes("502") ||
          error.message.includes("503") ||
          error.message.includes("504");
        return isNetworkError || isServerError;
      },
    }),

  /**
   * Database operation retry with constant backoff
   * Good for transient database connection issues
   */
  database: (fn: () => Promise<any>, maxRetries = 3): Promise<any> =>
    retry(fn, {
      maxRetries,
      baseDelayMs: 500,
      useExponentialBackoff: false,
      shouldRetry: (error) => {
        // Retry on connection errors or deadlocks
        return (
          error.message.includes("connection") ||
          error.message.includes("deadlock") ||
          error.message.includes("too many connections")
        );
      },
    }),
};
