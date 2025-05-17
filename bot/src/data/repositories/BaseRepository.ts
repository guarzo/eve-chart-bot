import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";
import { DatabaseUtils } from "../../utils/DatabaseUtils";

/**
 * Base repository class that all specific repositories will extend.
 * Provides common functionality and access to the database.
 */
export abstract class BaseRepository {
  protected prisma: PrismaClient;
  protected modelName: string;
  protected dbTableName: string | null;
  private cacheTTL: number = 60 * 1000; // Default cache TTL: 1 minute
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  constructor(modelName: string) {
    this.prisma = new PrismaClient();
    this.modelName = modelName;
    this.dbTableName = null; // Table name resolution is not needed with Prisma client
  }

  /**
   * Checks if the table for this repository exists in the database
   */
  async tableExists(): Promise<boolean> {
    return DatabaseUtils.tableExists(this.prisma, this.modelName);
  }

  /**
   * Set custom cache TTL in milliseconds
   */
  protected setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  /**
   * Cache result of a query with a given key
   */
  protected cacheResult<R>(key: string, data: R): R {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    return data;
  }

  /**
   * Get cached result if it exists and is not expired
   */
  protected getCachedResult<R>(key: string): R | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as R;
  }

  /**
   * Clear all cache or for a specific key
   */
  protected clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Execute a database query with error handling and optional caching
   */
  protected async executeQuery<R>(
    queryFn: () => Promise<R>,
    cacheKey?: string
  ): Promise<R> {
    try {
      // Try to get from cache if cacheKey is provided
      if (cacheKey) {
        const cached = this.getCachedResult<R>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Execute query
      const result = await queryFn();

      // Cache result if cacheKey is provided
      if (cacheKey) {
        this.cacheResult(cacheKey, result);
      }

      return result;
    } catch (error) {
      logger.error(`Error in ${this.modelName} repository:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
