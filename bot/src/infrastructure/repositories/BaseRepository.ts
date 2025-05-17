import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";
import { DatabaseUtils } from "../../utils/DatabaseUtils";
import prisma from "../persistence/client";
import { CacheAdapter } from "../cache/CacheAdapter";
import { RedisCache } from "../cache/RedisCache";

/**
 * Base repository class that all specific repositories will extend.
 * Provides common functionality and access to the database.
 */
export abstract class BaseRepository {
  protected prisma: PrismaClient;
  protected modelName: string;
  protected dbTableName: string | null;
  private cache: CacheAdapter;
  private cacheTtl: number = 3600; // Default TTL in seconds

  constructor(modelName: string, cache?: CacheAdapter) {
    this.prisma = prisma;
    this.modelName = modelName;
    this.dbTableName = null; // Table name resolution is not needed with Prisma client
    this.cache = cache || new RedisCache(`${modelName.toLowerCase()}:`);
  }

  /**
   * Set the cache TTL in seconds
   */
  protected setCacheTTL(ttl: number): void {
    this.cacheTtl = ttl;
  }

  /**
   * Checks if the table for this repository exists in the database
   */
  async tableExists(): Promise<boolean> {
    return DatabaseUtils.tableExists(this.prisma, this.modelName);
  }

  /**
   * Execute a database query with error handling and optional caching
   */
  protected async executeQuery<R>(
    queryFn: () => Promise<R>,
    cacheKey?: string,
    cacheTtl?: number
  ): Promise<R> {
    try {
      // Try to get from cache if cacheKey is provided
      if (cacheKey) {
        const cached = await this.cache.get<R>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Execute query
      const result = await queryFn();

      // Cache result if cacheKey is provided
      if (cacheKey) {
        await this.cache.set(cacheKey, result, cacheTtl || this.cacheTtl);
      }

      return result;
    } catch (error) {
      logger.error(`Error in ${this.modelName} repository:`, error);
      throw error;
    }
  }

  /**
   * Clear cache for a specific key or all keys for this repository
   */
  protected async clearCache(key?: string): Promise<void> {
    if (key) {
      await this.cache.delete(key);
    } else {
      await this.cache.clear();
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
