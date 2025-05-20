import { logger } from "../../lib/logger";

export class RetryService {
  constructor(
    private readonly maxRetries: number = 3,
    private readonly retryDelay: number = 5000,
    private readonly defaultTimeout: number = 30000
  ) {}

  async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries = this.maxRetries,
    retryDelay = this.retryDelay,
    timeout = this.defaultTimeout
  ): Promise<T | undefined> {
    let retryCount = 0;
    while (retryCount < maxRetries) {
      try {
        logger.info(
          `${operationName} (attempt ${retryCount + 1}/${maxRetries})`
        );
        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Operation timed out after ${timeout}ms`)),
            timeout
          );
        });

        // Race the operation against the timeout
        const result = await Promise.race([operation(), timeoutPromise]);
        return result;
      } catch (e: any) {
        retryCount++;

        // Format a simple human-readable error message
        const status = e.response?.status;
        const url = e.config?.url;
        const errorMsg = e.message || "Unknown error";

        if (retryCount >= maxRetries) {
          logger.error(
            `${operationName} failed after ${maxRetries} attempts: ${errorMsg}${
              status ? ` (${status})` : ""
            }${url ? ` - ${url}` : ""}`
          );
          return undefined;
        }

        logger.warn(
          `${operationName} failed (attempt ${retryCount}/${maxRetries}): ${errorMsg}${
            status ? ` (${status})` : ""
          }${url ? ` - ${url}` : ""}. Retrying in ${retryDelay / 1000}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
    return undefined;
  }
}
