import { RateLimiter } from './rateLimiter';
import { logger } from '../../lib/logger';

/**
 * Configuration for a rate limiter instance
 */
interface RateLimiterConfig {
  minDelayMs: number;
  serviceName: string;
}

/**
 * Default configurations for known services
 */
const DEFAULT_CONFIGS: Record<string, RateLimiterConfig> = {
  'Map API': {
    minDelayMs: 200, // 5 requests per second
    serviceName: 'Map API',
  },
  zKillboard: {
    minDelayMs: 1000, // 1 request per second (zKillboard's rate limit)
    serviceName: 'zKillboard',
  },
  ESI: {
    minDelayMs: 100, // 10 requests per second
    serviceName: 'ESI',
  },
};

/**
 * Singleton manager for rate limiters
 * Ensures shared rate limiting across all HTTP clients
 */
class RateLimiterManager {
  private static instance: RateLimiterManager;
  private rateLimiters: Map<string, RateLimiter> = new Map();

  private constructor() {
    logger.info('RateLimiterManager initialized');
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): RateLimiterManager {
    if (!RateLimiterManager.instance) {
      RateLimiterManager.instance = new RateLimiterManager();
    }
    return RateLimiterManager.instance;
  }

  /**
   * Get or create a rate limiter for a specific service
   * @param serviceName The name of the service
   * @param customConfig Optional custom configuration (overrides defaults)
   */
  public getRateLimiter(serviceName: string, customConfig?: Partial<RateLimiterConfig>): RateLimiter {
    // Check if we already have a rate limiter for this service
    let rateLimiter = this.rateLimiters.get(serviceName);

    if (!rateLimiter) {
      // Get default config or use provided values
      const defaultConfig = DEFAULT_CONFIGS[serviceName] || {
        minDelayMs: 1000,
        serviceName,
      };

      const config: RateLimiterConfig = {
        ...defaultConfig,
        ...customConfig,
      };

      // Create new rate limiter
      rateLimiter = new RateLimiter(config.minDelayMs, config.serviceName);
      this.rateLimiters.set(serviceName, rateLimiter);

      logger.info(`Created rate limiter for ${serviceName} with ${config.minDelayMs}ms delay`);
    }

    return rateLimiter;
  }

  /**
   * Reset all rate limiters
   */
  public resetAll(): void {
    this.rateLimiters.forEach((limiter, serviceName) => {
      limiter.reset();
      logger.debug(`Reset rate limiter for ${serviceName}`);
    });
  }

  /**
   * Reset a specific rate limiter
   * @param serviceName The name of the service
   */
  public reset(serviceName: string): void {
    const limiter = this.rateLimiters.get(serviceName);
    if (limiter) {
      limiter.reset();
      logger.debug(`Reset rate limiter for ${serviceName}`);
    }
  }

  /**
   * Clean up all rate limiters
   */
  public cleanup(): void {
    this.resetAll();
    this.rateLimiters.clear();
    logger.info('RateLimiterManager cleaned up');
  }

  /**
   * Get statistics about rate limiters
   */
  public getStats(): Record<string, { canMakeRequest: boolean; timeUntilNext: number }> {
    const stats: Record<string, { canMakeRequest: boolean; timeUntilNext: number }> = {};

    this.rateLimiters.forEach((limiter, serviceName) => {
      stats[serviceName] = {
        canMakeRequest: limiter.canMakeRequest(),
        timeUntilNext: limiter.getTimeUntilNextRequest(),
      };
    });

    return stats;
  }
}

// Export singleton instance
export const rateLimiterManager = RateLimiterManager.getInstance();
