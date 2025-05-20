import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { logger } from "../../lib/logger";
import { CacheAdapter } from "../cache/CacheAdapter";
import { RedisCache } from "../../lib/cache/RedisCache";
import { ESIClientConfig, IESIClient } from "./ESIClient";

/**
 * Unified client for interacting with EVE Online's ESI API
 * Combines caching and retry logic from previous implementations
 */
export class UnifiedESIClient implements IESIClient {
  private readonly client: AxiosInstance;
  private readonly config: Required<ESIClientConfig>;
  private readonly cache: CacheAdapter;

  /**
   * Create a new unified ESI client
   * @param config Optional configuration for the client
   * @param cache Optional cache adapter to use for requests
   */
  constructor(config: ESIClientConfig = {}, cache?: CacheAdapter) {
    this.config = {
      baseUrl: config.baseUrl || "https://esi.evetech.net/latest",
      timeout: config.timeout || 10000,
      userAgent: config.userAgent || "EVE-Chart-Bot/1.0",
      cacheTtl: config.cacheTtl || 3600, // Default 1 hour cache
      maxRetries: config.maxRetries || 3,
      initialRetryDelay: config.initialRetryDelay || 1000,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        "User-Agent": this.config.userAgent,
        Accept: "application/json",
      },
    });

    this.cache = cache || new RedisCache("esi:");
  }

  /**
   * Fetch data from ESI with caching and retry logic
   * @param endpoint API endpoint to fetch
   * @param options Additional request options
   */
  async fetch<T>(
    endpoint: string,
    options: AxiosRequestConfig = {}
  ): Promise<T> {
    const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const cacheKey = this.buildCacheKey(url, options.params || {});

    try {
      // Try to get from cache first
      const cachedData = await this.cache.get<T>(cacheKey);
      if (cachedData) {
        logger.debug(`ESI cache hit for ${url}`);
        return cachedData;
      }

      // Not in cache, fetch from API with retry logic
      logger.debug(`ESI cache miss for ${url}, fetching from API`);
      const data = await this.fetchWithRetry<T>(url, options);

      // Cache the response
      await this.cache.set(cacheKey, data, this.config.cacheTtl);

      return data;
    } catch (error) {
      logger.error(`Error fetching from ESI ${url}:`, error);
      throw error;
    }
  }

  /**
   * Fetch data with retry logic
   */
  private async fetchWithRetry<T>(
    url: string,
    options: AxiosRequestConfig,
    retryCount = 0
  ): Promise<T> {
    try {
      const response = await this.client.get<T>(url, options);
      return response.data;
    } catch (error) {
      if (retryCount >= this.config.maxRetries) {
        throw error;
      }

      // Check if we should retry based on error type
      const shouldRetry =
        error instanceof Error &&
        (error.message.includes("429") || // Rate limit
          error.message.includes("503") || // Service unavailable
          error.message.includes("504") || // Gateway timeout
          error.message.includes("ECONNRESET") || // Connection reset
          error.message.includes("ETIMEDOUT")); // Connection timeout

      if (!shouldRetry) {
        throw error;
      }

      // Calculate exponential backoff delay
      const delay = this.config.initialRetryDelay * Math.pow(2, retryCount);
      logger.warn("ESI request failed, retrying...", {
        url,
        retryCount: retryCount + 1,
        delay,
        error: error instanceof Error ? error.message : error,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.fetchWithRetry<T>(url, options, retryCount + 1);
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
            .join("&")
        : "";

    return `esi:${endpoint}${paramString ? `?${paramString}` : ""}`;
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
      const normalizedEndpoint = endpoint.startsWith("/")
        ? endpoint
        : `/${endpoint}`;
      await this.cache.delete(`esi:${normalizedEndpoint}`);
    } else {
      // Clear all ESI cache
      await this.cache.clear();
    }
  }
}
