import { logger } from "../lib/logger";
import {
  HTTP_MAX_RETRIES,
  HTTP_INITIAL_RETRY_DELAY,
  HTTP_MAX_RETRY_DELAY,
} from "../config";

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  serviceName?: string;
}

/**
 * Retry an operation with exponential backoff
 * Simplified version that focuses on the core retry logic
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = HTTP_MAX_RETRIES,
    initialDelayMs = HTTP_INITIAL_RETRY_DELAY,
    maxDelayMs = HTTP_MAX_RETRY_DELAY,
    backoffFactor = 2,
    serviceName = "Operation",
  } = options;

  let lastError: Error | null = null;
  let currentDelay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if this is the last attempt
      if (attempt >= maxRetries) {
        break;
      }

      // Log the error and retry attempt
      logger.warn(
        `${serviceName} failed on attempt ${attempt}/${maxRetries}: ${error.message}`
      );

      // Calculate next delay with exponential backoff
      currentDelay = Math.min(currentDelay * backoffFactor, maxDelayMs);

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 1000;
      const delayWithJitter = currentDelay + jitter;

      logger.info(
        `Retrying ${serviceName} in ${Math.round(
          delayWithJitter / 1000
        )}s (attempt ${attempt + 1}/${maxRetries})`
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayWithJitter));
    }
  }

  throw new Error(
    `${serviceName} failed after ${maxRetries} attempts: ${lastError?.message}`
  );
}
