import { CacheAdapter } from "./CacheAdapter";
import { logger } from "../../lib/logger";

interface CacheEntry<T> {
  value: T;
  expiry: number | null;
}

/**
 * Simple in-memory implementation of the CacheAdapter
 * Useful for testing or when Redis is not available
 */
export class MemoryCache implements CacheAdapter {
  private readonly cache: Map<string, CacheEntry<any>>;
  private readonly defaultTtl: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Create a new in-memory cache adapter
   * @param defaultTtl Default TTL in seconds (0 means no expiration)
   * @param cleanupIntervalMs How often to check for expired entries (ms)
   */
  constructor(defaultTtl: number = 300, cleanupIntervalMs: number = 60000) {
    this.cache = new Map();
    this.defaultTtl = defaultTtl;

    // Setup cleanup interval if TTL is used
    if (cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(() => {
        this.removeExpiredEntries();
      }, cleanupIntervalMs);
    }
  }

  /**
   * Remove expired cache entries
   */
  private removeExpiredEntries(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry !== null && entry.expiry < now) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.debug(`Cleaned up ${expiredCount} expired cache entries`);
    }
  }

  /**
   * Get a value from the cache
   * @param key The cache key
   * @returns The cached value or null if not found or expired
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if the entry has expired
    if (entry.expiry !== null && entry.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set a value in the cache
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Time to live in seconds (optional)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const actualTtl = ttl ?? this.defaultTtl;
    const expiry = actualTtl > 0 ? Date.now() + (actualTtl * 1000) : null;

    this.cache.set(key, {
      value,
      expiry
    });
  }

  /**
   * Delete a key from the cache
   * @param key The cache key to delete
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Clear the entire cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
} 