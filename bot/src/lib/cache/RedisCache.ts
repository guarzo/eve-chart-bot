import Redis from "ioredis";
import { logger } from "../logger";

export class RedisCache {
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

  async set(
    key: string,
    value: any,
    ttl: number = this.defaultTtl
  ): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttl);
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
