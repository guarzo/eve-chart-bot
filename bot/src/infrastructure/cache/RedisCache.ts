import { Redis } from "ioredis";
import { CacheAdapter } from "./CacheAdapter";
import { logger } from "../../lib/logger";

/**
 * Redis-backed implementation of the CacheAdapter
 */
export class RedisCache implements CacheAdapter {
  private readonly redis: Redis;
  private readonly defaultTtl: number;
  private readonly prefix: string;

  /**
   * Create a new Redis cache adapter
   * @param redisUrl Redis connection URL
   * @param defaultTtl Default TTL in seconds
   * @param prefix Key prefix for namespacing
   */
  constructor(
    redisUrl: string,
    defaultTtl: number = 300,
    prefix: string = "eve-chart:"
  ) {
    this.redis = new Redis(redisUrl);
    this.defaultTtl = defaultTtl;
    this.prefix = prefix;

    // Log connection events
    this.redis.on("connect", () => {
      logger.info("Connected to Redis");
    });

    this.redis.on("error", (err) => {
      logger.error({ error: err.message }, "Redis connection error");
    });
  }

  /**
   * Generate a prefixed key
   * @param key The base key
   * @returns The prefixed key
   */
  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Get a value from the cache
   * @param key The cache key
   * @returns The cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(this.getKey(key));
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          key,
        },
        "Failed to get value from Redis cache"
      );
      return null;
    }
  }

  /**
   * Set a value in the cache
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Time to live in seconds (optional)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      const actualTtl = ttl ?? this.defaultTtl;

      await this.redis.setex(this.getKey(key), actualTtl, serializedValue);
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          key,
        },
        "Failed to set value in Redis cache"
      );
    }
  }

  /**
   * Delete a key from the cache
   * @param key The cache key to delete
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(this.getKey(key));
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          key,
        },
        "Failed to delete key from Redis cache"
      );
    }
  }

  /**
   * Clear all keys with the configured prefix
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.prefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to clear Redis cache"
      );
    }
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}
