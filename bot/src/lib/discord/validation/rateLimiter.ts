import { Redis } from 'ioredis';
import { logger } from '../../logger';
import { redisClient as getDefaultRedisClient } from '../../../infrastructure/cache/redis-client';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export class RateLimiter {
  private redis: Redis;
  private defaultConfig: RateLimitConfig = {
    maxRequests: 10,
    windowMs: 60000, // 1 minute
    keyPrefix: 'ratelimit',
  };

  constructor(redisClient?: Redis) {
    this.redis = redisClient ?? getDefaultRedisClient();
  }

  /**
   * Check if a request is allowed based on rate limits
   */
  async checkLimit(identifier: string, config?: Partial<RateLimitConfig>): Promise<RateLimitResult> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const key = `${finalConfig.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - finalConfig.windowMs;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Remove old entries outside the window
      pipeline.zremrangebyscore(key, '-inf', windowStart);

      // Count current requests in window
      pipeline.zcard(key);

      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiry
      pipeline.expire(key, Math.ceil(finalConfig.windowMs / 1000));

      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      const count = (results[1][1] as number) + 1; // Current count + new request
      const allowed = count <= finalConfig.maxRequests;

      // If not allowed, remove the request we just added
      if (!allowed) {
        await this.redis.zrem(key, `${now}-${Math.random()}`);
      }

      const remaining = Math.max(0, finalConfig.maxRequests - count);
      const oldestEntry = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetAt =
        oldestEntry.length > 1
          ? new Date(parseInt(oldestEntry[1]) + finalConfig.windowMs)
          : new Date(now + finalConfig.windowMs);

      const result: RateLimitResult = {
        allowed,
        limit: finalConfig.maxRequests,
        remaining: allowed ? remaining : remaining + 1,
        resetAt,
      };

      if (!allowed) {
        result.retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);
      }

      return result;
    } catch (error) {
      logger.error('Rate limiter error:', error);
      // On error, allow the request but log it
      return {
        allowed: true,
        limit: finalConfig.maxRequests,
        remaining: finalConfig.maxRequests,
        resetAt: new Date(now + finalConfig.windowMs),
      };
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getStatus(identifier: string, config?: Partial<RateLimitConfig>): Promise<RateLimitResult> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const key = `${finalConfig.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - finalConfig.windowMs;

    try {
      // Remove old entries and count current
      await this.redis.zremrangebyscore(key, '-inf', windowStart);
      const count = await this.redis.zcard(key);

      const remaining = Math.max(0, finalConfig.maxRequests - count);
      const oldestEntry = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetAt =
        oldestEntry.length > 1
          ? new Date(parseInt(oldestEntry[1]) + finalConfig.windowMs)
          : new Date(now + finalConfig.windowMs);

      return {
        allowed: count < finalConfig.maxRequests,
        limit: finalConfig.maxRequests,
        remaining,
        resetAt,
      };
    } catch (error) {
      logger.error('Rate limiter status error:', error);
      return {
        allowed: true,
        limit: finalConfig.maxRequests,
        remaining: finalConfig.maxRequests,
        resetAt: new Date(now + finalConfig.windowMs),
      };
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string, keyPrefix?: string): Promise<void> {
    const prefix = keyPrefix ?? this.defaultConfig.keyPrefix;
    const key = `${prefix}:${identifier}`;

    try {
      await this.redis.del(key);
      logger.info(`Rate limit reset for ${identifier}`);
    } catch (error) {
      logger.error('Rate limiter reset error:', error);
    }
  }
}

// Pre-configured rate limiters for different scenarios
export const rateLimiters = {
  // Per-user rate limits
  user: new RateLimiter(),

  // Per-guild rate limits (more lenient)
  guild: new RateLimiter(),

  // Strict rate limit for potentially expensive operations
  expensive: new RateLimiter(),
};

// Rate limit configurations for different command types
export const rateLimitConfigs = {
  // Default for most commands
  default: {
    maxRequests: 10,
    windowMs: 60000, // 10 requests per minute
  },

  // For chart generation commands (more expensive)
  charts: {
    maxRequests: 5,
    windowMs: 60000, // 5 requests per minute
  },

  // For list/info commands (cheaper)
  info: {
    maxRequests: 20,
    windowMs: 60000, // 20 requests per minute
  },

  // Guild-wide limits (shared across all users in a guild)
  guild: {
    maxRequests: 30,
    windowMs: 60000, // 30 requests per minute per guild
  },

  // Suspicious activity (very strict)
  suspicious: {
    maxRequests: 1,
    windowMs: 300000, // 1 request per 5 minutes
  },
};
