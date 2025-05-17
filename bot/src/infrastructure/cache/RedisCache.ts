import { CacheAdapter } from "./CacheAdapter";
import redis from "./redis-client";
import { logger } from "../../lib/logger";

/**
 * Redis implementation of the cache adapter
 */
export class RedisCache implements CacheAdapter {
  private prefix: string;
  private defaultTtl: number;

  /**
   * Create a new Redis cache
   * @param prefix Optional prefix for all cache keys
   * @param defaultTtl Default TTL in seconds (1 hour default)
   */
  constructor(prefix = "evechart:", defaultTtl = 3600) {
    this.prefix = prefix;
    this.defaultTtl = defaultTtl;
  }

  /**
   * Get full cache key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Get a value from the cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const data = await redis.get(fullKey);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(
        `Redis cache get error for key ${key}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /**
   * Set a value in the cache
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const ttl = ttlSeconds || this.defaultTtl;
      const serializedValue = JSON.stringify(value);

      await redis.set(fullKey, serializedValue, "EX", ttl);
    } catch (error) {
      logger.error(
        `Redis cache set error for key ${key}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Delete a key from the cache
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await redis.del(fullKey);
    } catch (error) {
      logger.error(
        `Redis cache delete error for key ${key}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Clear all keys with this prefix
   */
  async clear(): Promise<void> {
    try {
      // Find all keys with our prefix
      const pattern = `${this.prefix}*`;
      let cursor = "0";

      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch (error) {
      logger.error(
        `Redis cache clear error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
