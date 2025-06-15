import { logger } from '../../lib/logger';
import { timerManager } from './timerManager';
import { ValidatedConfiguration } from '../../config/validated';

/**
 * Configuration options for retry logic
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base delay in milliseconds between retries */
  baseDelayMs?: number;
  /** Initial delay for exponential backoff (alias for baseDelayMs) */
  initialDelayMs?: number;
  /** Initial retry delay (legacy alias) */
  initialRetryDelay?: number;
  /** Maximum delay in milliseconds for exponential backoff */
  maxDelayMs?: number;
  /** Maximum retry delay (legacy alias) */
  maxRetryDelay?: number;
  /** Whether to use exponential backoff (true) or constant delay (false) */
  useExponentialBackoff?: boolean;
  /** Backoff multiplier factor for exponential backoff */
  backoffFactor?: number;
  /** Custom error handler function */
  onError?: (error: Error, attempt: number) => void;
  /** Predicate to determine if an error should trigger a retry */
  shouldRetry?: (error: Error) => boolean;
  /** Optional timeout for each attempt in milliseconds */
  timeout?: number;
  /** Service/operation name for logging */
  serviceName?: string;
  /** Abort signal to cancel retry operation */
  abortSignal?: AbortSignal;
  /** Whether to add jitter to retry delays */
  addJitter?: boolean;
}

/**
 * Unified retry function that combines features from all retry implementations
 * @param fn The function to retry
 * @param description Description of the operation for logging
 * @param options Retry configuration options
 * @returns A Promise that resolves with the result of the function or rejects after max retries
 */
export async function retry<T>(fn: () => Promise<T>, description?: string, options: RetryOptions = {}): Promise<T> {
  // Normalize options to handle legacy aliases
  const baseDelay =
    options.baseDelayMs ?? options.initialDelayMs ?? options.initialRetryDelay ?? ValidatedConfiguration.http.initialRetryDelay;

  const maxDelay = options.maxDelayMs ?? options.maxRetryDelay ?? ValidatedConfiguration.http.maxRetryDelay;

  const {
    maxRetries = ValidatedConfiguration.http.maxRetries,
    useExponentialBackoff = true,
    backoffFactor = 2,
    onError,
    shouldRetry = () => true,
    timeout = options.timeout,
    serviceName = options.serviceName ?? description ?? 'Operation',
    abortSignal,
    addJitter = true,
  } = options;

  let lastError: Error | null = null;
  let currentDelay = baseDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Check if operation was aborted
    if (abortSignal?.aborted) {
      throw new Error(`${serviceName} aborted: ${abortSignal.reason ?? 'Operation cancelled'}`);
    }

    try {
      // Create operation promise
      let operationPromise = fn();

      // Add timeout if specified
      if (timeout) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`${serviceName} timed out after ${timeout}ms`));
          }, timeout);
        });
        operationPromise = Promise.race([operationPromise, timeoutPromise]);
      }

      return await operationPromise;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (!shouldRetry(lastError)) {
        logger.error(`${serviceName} error not eligible for retry: ${lastError.message}`);
        throw lastError;
      }

      // Check if this is the last attempt or if aborted
      if (attempt >= maxRetries || abortSignal?.aborted) {
        break;
      }

      // Call custom error handler if provided
      if (onError) {
        onError(lastError, attempt);
      } else {
        // Default error logging
        const isTimeout = lastError.message.includes('timed out');
        const isRateLimit = lastError.message.includes('rate limit') || lastError.message.includes('429');

        if (isTimeout) {
          logger.warn(`${serviceName} timeout on attempt ${attempt}/${maxRetries}`);
        } else if (isRateLimit) {
          logger.warn(`${serviceName} rate limit hit on attempt ${attempt}/${maxRetries}`);
        } else {
          logger.warn(`${serviceName} failed on attempt ${attempt}/${maxRetries}: ${lastError.message}`);
        }
      }

      // Calculate next delay
      if (useExponentialBackoff) {
        currentDelay = Math.min(currentDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
      }

      // Add jitter if enabled
      let finalDelay = currentDelay;
      if (addJitter) {
        const jitter = Math.random() * Configuration.jitter.maxMs;
        finalDelay = currentDelay + jitter;
      }

      logger.info(
        `Retrying ${serviceName} in ${Math.round(finalDelay / 1000)}s (attempt ${attempt + 1}/${maxRetries})`
      );

      // Wait before retrying with abort support
      try {
        if (abortSignal) {
          await timerManager.delay(finalDelay, abortSignal);
        } else {
          await new Promise(resolve => setTimeout(resolve, finalDelay));
        }
      } catch (error) {
        throw new Error(
          `${serviceName} aborted during retry delay: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  if (abortSignal?.aborted) {
    throw new Error(`${serviceName} aborted: ${abortSignal.reason || 'Operation cancelled'}`);
  }

  throw new Error(`${serviceName} failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use retry() instead
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  description: string,
  options: RetryOptions = {}
): Promise<T> {
  return retry(operation, description, options);
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use retry() instead
 */
export async function retryWithBackoff<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  return retry(operation, options.serviceName, options);
}

/**
 * Convenience wrapper for common retry patterns
 */
export const retryStrategies = {
  /**
   * HTTP request retry with exponential backoff
   * Retries on network errors and 5xx responses
   */
  http: <T>(fn: () => Promise<T>, maxRetries = HTTP_MAX_RETRIES): Promise<T> =>
    retry(fn, 'HTTP request', {
      maxRetries,
      baseDelayMs: HTTP_INITIAL_RETRY_DELAY,
      maxDelayMs: ValidatedConfiguration.http.maxRetryDelay,
      useExponentialBackoff: true,
      timeout: ValidatedConfiguration.http.timeout,
      shouldRetry: error => {
        // Retry on network errors or server errors (5xx)
        const isNetworkError =
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('ENOTFOUND') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('ECONNABORTED');
        const isServerError =
          error.message.includes('500') ||
          error.message.includes('502') ||
          error.message.includes('503') ||
          error.message.includes('504');
        const isTimeout = error.message.includes('timed out');
        const isRateLimit = error.message.includes('429') || error.message.includes('rate limit');
        return isNetworkError || isServerError || isTimeout || isRateLimit;
      },
    }),

  /**
   * Database operation retry with constant backoff
   * Good for transient database connection issues
   */
  database: <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> =>
    retry(fn, 'Database operation', {
      maxRetries,
      baseDelayMs: 500,
      useExponentialBackoff: false,
      shouldRetry: error => {
        // Retry on connection errors or deadlocks
        return (
          error.message.includes('connection') ||
          error.message.includes('deadlock') ||
          error.message.includes('too many connections') ||
          error.message.includes('ECONNREFUSED')
        );
      },
    }),
};

/**
 * Rate limit helper for API clients
 */
export class RateLimiter {
  private lastRequestTime: number = 0;

  constructor(private readonly minDelayMs: number) {}

  /**
   * Wait if necessary to respect rate limits
   */
  async wait(signal?: AbortSignal): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      const delay = this.minDelayMs - elapsed;
      if (signal) {
        await timerManager.delay(delay, signal);
      } else {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
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
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly maxFailuresBeforeOpen: number = 3,
    private readonly cooldownPeriodMs: number = 30000, // 30 seconds
    private readonly serviceName: string = 'Unknown Service'
  ) {}

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(
          `Circuit breaker OPEN for ${
            this.serviceName
          }: cooling down until ${new Date(this.nextAttemptTime).toISOString()}`
        );
      } else {
        // Transition to HALF_OPEN to test if service is back
        this.state = 'HALF_OPEN';
        logger.info(`Circuit breaker for ${this.serviceName} transitioning to HALF_OPEN for test`);
      }
    }

    try {
      const result = await operation();

      // Success - reset failure count and close circuit if needed
      if (this.state === 'HALF_OPEN') {
        logger.info(`Circuit breaker for ${this.serviceName} test successful, transitioning to CLOSED`);
        this.state = 'CLOSED';
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

      if (this.failureCount >= this.maxFailuresBeforeOpen || this.state === 'HALF_OPEN') {
        // Open the circuit
        this.state = 'OPEN';
        this.nextAttemptTime = Date.now() + this.cooldownPeriodMs;

        logger.error(
          `Circuit breaker for ${this.serviceName} OPENED due to ${
            this.failureCount
          } failures. Will attempt retry at ${new Date(this.nextAttemptTime).toISOString()}`
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
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.nextAttemptTime = 0;
    logger.info(`Circuit breaker for ${this.serviceName} manually reset`);
  }
}
