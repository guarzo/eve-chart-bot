/**
 * Generic interface for cache implementations
 */
export interface CacheAdapter {
  /**
   * Get a value from cache
   * @param key The cache key
   * @returns The cached value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache with optional TTL
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Time to live in seconds (optional)
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a key from the cache
   * @param key The cache key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Clear the entire cache (use with caution)
   */
  clear(): Promise<void>;
}
