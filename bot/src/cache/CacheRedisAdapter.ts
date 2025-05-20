import Redis from "ioredis";
import { logger } from "../lib/logger";
import { CacheAdapter } from "./CacheAdapter";

export class CacheRedisAdapter implements CacheAdapter {
  private client: Redis;
  private readonly defaultTtl: number;

  constructor(url: string, defaultTtl: number = 300) {
    // 5 minutes default
    this.client = new Redis(url);
    this.defaultTtl = defaultTtl;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error({ error, key }, "Failed to get data from Redis cache");
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = this.defaultTtl
  ): Promise<void> {
    try {
      const stringValue =
        typeof value === "string" ? value : JSON.stringify(value);
      await this.client.set(key, stringValue, "EX", ttlSeconds);
    } catch (error) {
      logger.error({ error, key }, "Failed to set data in Redis cache");
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error({ error, key }, "Failed to delete data from Redis cache");
    }
  }

  async delete(key: string): Promise<void> {
    return this.del(key);
  }

  async clear(): Promise<void> {
    try {
      await this.client.flushall();
    } catch (error) {
      logger.error({ error }, "Failed to clear Redis cache");
    }
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.defaultTtl
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) {
      return cached;
    }

    const fresh = await fetchFn();
    await this.set(key, fresh, ttl);
    return fresh;
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
