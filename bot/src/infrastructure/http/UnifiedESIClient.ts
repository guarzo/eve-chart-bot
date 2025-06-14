import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { logger } from '../../lib/logger';
import { CacheAdapter } from '../../cache/CacheAdapter';
import { CacheRedisAdapter } from '../../cache/CacheRedisAdapter';
import { ESIClientConfig, IESIClient } from './ESIClient';
import { retryOperation } from '../../utils/retry';
import { RateLimiter } from '../../utils/rateLimiter';
import { rateLimiterManager } from '../../utils/RateLimiterManager';
import {
  REDIS_URL,
  ESI_BASE_URL,
  CACHE_TTL,
  HTTP_TIMEOUT,
  HTTP_MAX_RETRIES,
  HTTP_INITIAL_RETRY_DELAY,
} from '../../config';

/**
 * Unified client for interacting with EVE Online's ESI API
 * Combines caching and retry logic from previous implementations
 */
export class UnifiedESIClient implements IESIClient {
  private readonly client: AxiosInstance;
  private readonly config: Required<ESIClientConfig>;
  private readonly cache: CacheAdapter;
  private readonly rateLimiter: RateLimiter | null = null;

  /**
   * Create a new unified ESI client
   * @param config Optional configuration for the client
   * @param cache Optional cache adapter to use for requests
   */
  constructor(config: ESIClientConfig = {}, cache?: CacheAdapter) {
    this.config = {
      baseUrl: config.baseUrl ?? ESI_BASE_URL,
      timeout: config.timeout ?? HTTP_TIMEOUT,
      userAgent: config.userAgent ?? 'EVE-Chart-Bot/1.0',
      cacheTtl: config.cacheTtl ?? CACHE_TTL,
      maxRetries: config.maxRetries ?? HTTP_MAX_RETRIES,
      initialRetryDelay: config.initialRetryDelay ?? HTTP_INITIAL_RETRY_DELAY,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'User-Agent': this.config.userAgent,
        Accept: 'application/json',
      },
    });

    this.cache = cache ?? new CacheRedisAdapter(REDIS_URL, this.config.cacheTtl);

    // Only use rate limiter if this is an ESI client (not used for other APIs)
    if (this.config.baseUrl.includes('esi')) {
      this.rateLimiter = rateLimiterManager.getRateLimiter('ESI');
    }
  }

  /**
   * Fetch data from ESI with caching and retry logic
   * @param endpoint API endpoint to fetch
   * @param options Additional request options
   */
  async fetch<T>(endpoint: string, options: AxiosRequestConfig = {}): Promise<T> {
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const cacheKey = this.buildCacheKey(url, options.params ?? {});

    try {
      // Try to get from cache first
      const cachedData = await this.cache.get<T>(cacheKey);
      if (cachedData) {
        logger.debug(`ESI cache hit for ${url}`);
        return cachedData;
      }

      // Not in cache, fetch from API with retry logic
      logger.debug(`ESI cache miss for ${url}, fetching from API`);

      // Apply rate limiting if configured
      if (this.rateLimiter && options.signal) {
        // Cast to AbortSignal if it's compatible
        await this.rateLimiter.wait(options.signal as AbortSignal);
      } else if (this.rateLimiter) {
        await this.rateLimiter.wait();
      }

      const data = await retryOperation(
        () => this.client.get<T>(url, options).then(response => response.data),
        `ESI request to ${url}`,
        {
          maxRetries: this.config.maxRetries,
          initialRetryDelay: this.config.initialRetryDelay,
          timeout: this.config.timeout,
        }
      );

      if (!data) {
        throw new Error(`Failed to fetch data from ESI after ${this.config.maxRetries} retries`);
      }

      // Cache the response
      await this.cache.set(cacheKey, data, this.config.cacheTtl);

      return data;
    } catch (error) {
      logger.error(`Error fetching from ESI ${url}:`, error);
      throw error;
    }
  }

  /**
   * Build a cache key from an endpoint and parameters
   */
  private buildCacheKey(endpoint: string, params: Record<string, any>): string {
    const paramString =
      Object.keys(params).length > 0
        ? Object.entries(params)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([key, value]) => `${key}=${value}`)
            .join('&')
        : '';

    return `esi:${endpoint}${paramString ? `?${paramString}` : ''}`;
  }

  /**
   * Fetch killmail data
   */
  async fetchKillmail(killmailId: number, hash: string): Promise<any> {
    return this.fetch(`/killmails/${killmailId}/${hash}/`);
  }

  /**
   * Fetch character information
   */
  async fetchCharacter(characterId: number): Promise<any> {
    return this.fetch(`/characters/${characterId}/`);
  }

  /**
   * Fetch corporation information
   */
  async fetchCorporation(corporationId: number): Promise<any> {
    return this.fetch(`/corporations/${corporationId}/`);
  }

  /**
   * Fetch alliance information
   */
  async fetchAlliance(allianceId: number): Promise<any> {
    return this.fetch(`/alliances/${allianceId}/`);
  }

  /**
   * Fetch solar system information
   */
  async fetchSolarSystem(systemId: number): Promise<any> {
    return this.fetch(`/universe/systems/${systemId}/`);
  }

  /**
   * Fetch type information
   */
  async fetchType(typeId: number): Promise<any> {
    return this.fetch(`/universe/types/${typeId}/`);
  }

  /**
   * Clear the cache for a specific endpoint
   */
  async clearCache(endpoint?: string): Promise<void> {
    if (endpoint) {
      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      await this.cache.delete(`esi:${normalizedEndpoint}`);
    } else {
      // Clear all ESI cache
      await this.cache.clear();
    }
  }
}
