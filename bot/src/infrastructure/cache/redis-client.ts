import { Redis } from 'ioredis';
import { ValidatedConfiguration } from '../../config/validated';
import { logger } from '../../lib/logger';

const redisUrl = ValidatedConfiguration.redis.url;

// Create a Redis client singleton
const redisClient = new Redis(redisUrl);

// Extend Redis client with additional methods for chart caching
class ExtendedRedisClient {
  private client: Redis;

  constructor(client: Redis) {
    this.client = client;
  }

  // Proxy all Redis methods
  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  set(key: string, value: string | Buffer, ...args: any[]): Promise<'OK'> {
    return this.client.set(key, value, ...args);
  }

  setex(key: string, seconds: number, value: string | Buffer): Promise<'OK'> {
    return this.client.setex(key, seconds, value);
  }

  del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  // Buffer-specific operations for chart caching
  async getBuffer(key: string): Promise<Buffer | null> {
    const result = await this.client.getBuffer(key);
    return result;
  }

  async setBuffer(key: string, buffer: Buffer): Promise<'OK'> {
    return this.client.set(key, buffer);
  }

  async setexBuffer(key: string, seconds: number, buffer: Buffer): Promise<'OK'> {
    return this.client.setex(key, seconds, buffer);
  }

  // Additional Redis methods as needed
  exists(...keys: string[]): Promise<number> {
    return this.client.exists(...keys);
  }

  expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  ping(): Promise<string> {
    return this.client.ping();
  }

  // Sorted set operations
  zadd(key: string, ...args: (string | number)[]): Promise<string | number> {
    return this.client.zadd(key, ...args);
  }

  zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrange(key, start, stop);
  }

  zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrevrange(key, start, stop);
  }

  zrem(key: string, ...members: (string | Buffer)[]): Promise<number> {
    return this.client.zrem(key, ...members);
  }

  zrangebyscore(key: string, min: number | string, max: number | string, ...args: any[]): Promise<string[]> {
    return this.client.zrangebyscore(key, min, max, ...args);
  }

  zcount(key: string, min: number | string, max: number | string): Promise<number> {
    return this.client.zcount(key, min, max);
  }

  incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  // For accessing the underlying client if needed
  getClient(): Redis {
    return this.client;
  }
}

// Create extended Redis client
const extendedRedis = new ExtendedRedisClient(redisClient);

// Log connection state
redisClient.on('connect', () => {
  logger.info(`Redis client connected to ${redisUrl}`);
});

redisClient.on('error', err => {
  logger.error(`Redis client error: ${err.message}`);
});

// Export both the original and extended clients
export { redisClient, extendedRedis as redis };
