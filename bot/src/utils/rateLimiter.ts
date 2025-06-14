import { logger } from '../lib/logger';
import { timerManager } from './timerManager';

/**
 * Rate limiter utility for API clients
 * Ensures minimum delay between requests to respect API rate limits
 */
export class RateLimiter {
  private lastRequestTime: number = 0;

  constructor(
    private readonly minDelayMs: number,
    private readonly serviceName: string = 'API'
  ) {}

  /**
   * Wait if necessary to respect rate limits
   * @param signal Optional AbortSignal for cancellation
   * @returns Promise that resolves when it's safe to make the next request
   */
  async wait(signal?: AbortSignal): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minDelayMs) {
      const delay = this.minDelayMs - elapsed;
      logger.debug(`Rate limiting ${this.serviceName} - waiting ${delay}ms before next request`);

      try {
        await timerManager.delay(delay, signal);
      } catch (error) {
        throw new Error(
          `Rate limiter for ${this.serviceName} aborted: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Get the time until the next request can be made
   * @returns milliseconds until next request is allowed, or 0 if ready now
   */
  getTimeUntilNextRequest(): number {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    return Math.max(0, this.minDelayMs - elapsed);
  }

  /**
   * Check if a request can be made immediately
   * @returns true if no delay is needed
   */
  canMakeRequest(): boolean {
    return this.getTimeUntilNextRequest() === 0;
  }

  /**
   * Reset the rate limiter (useful for testing or manual resets)
   */
  reset(): void {
    this.lastRequestTime = 0;
    logger.debug(`Rate limiter for ${this.serviceName} reset`);
  }
}
