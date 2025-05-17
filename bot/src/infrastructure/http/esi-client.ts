import axios, { AxiosInstance } from "axios";
import { logger } from "../../lib/logger";
import { CacheAdapter } from "../cache/CacheAdapter";
import { RedisCache } from "../cache/RedisCache";

interface ESIClientConfig {
  baseUrl?: string;
  timeout?: number;
  userAgent?: string;
  cacheTtl?: number;
}

/**
 * Client for interacting with EVE Online's ESI API with caching support
 */
export class ESIClient {
  private readonly client: AxiosInstance;
  private readonly config: Required<ESIClientConfig>;
  private readonly cache: CacheAdapter;

  /**
   * Create a new ESI client
   * @param config Optional configuration for the client
   * @param cache Optional cache adapter to use for requests
   */
  constructor(config: ESIClientConfig = {}, cache?: CacheAdapter) {
    this.config = {
      baseUrl: config.baseUrl || "https://esi.evetech.net/latest",
      timeout: config.timeout || 10000,
      userAgent: config.userAgent || "EVE-Chart-Bot/1.0",
      cacheTtl: config.cacheTtl || 3600, // Default 1 hour cache
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
   * Fetch data from ESI with caching
   * @param endpoint API endpoint to fetch
   * @param params Optional query parameters
   */
  async fetch<T>(
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    try {
      // Generate cache key from endpoint and params
      const cacheKey = this.buildCacheKey(endpoint, params);

      // Try to get from cache first
      const cachedData = await this.cache.get<T>(cacheKey);
      if (cachedData) {
        logger.debug(`ESI cache hit for ${endpoint}`);
        return cachedData;
      }

      // Not in cache, fetch from API
      logger.debug(`ESI cache miss for ${endpoint}, fetching from API`);
      const response = await this.client.get<T>(endpoint, { params });
      const data = response.data;

      // Cache the response
      await this.cache.set(cacheKey, data, this.config.cacheTtl);

      return data;
    } catch (error) {
      logger.error(`Error fetching from ESI ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Build a cache key from an endpoint and parameters
   */
  private buildCacheKey(endpoint: string, params: Record<string, any>): string {
    const normalizedEndpoint = endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;
    const paramString =
      Object.keys(params).length > 0
        ? Object.entries(params)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([key, value]) => `${key}=${value}`)
            .join("&")
        : "";

    return `esi:${normalizedEndpoint}${paramString ? `?${paramString}` : ""}`;
  }

  /**
   * Fetch killmail data
   * @param killmailId Killmail ID
   * @param hash Killmail hash
   */
  async fetchKillmail(killmailId: number, hash: string): Promise<any> {
    return this.fetch(`/killmails/${killmailId}/${hash}/`);
  }

  /**
   * Fetch character information
   * @param characterId Character ID
   */
  async fetchCharacter(characterId: number): Promise<any> {
    return this.fetch(`/characters/${characterId}/`);
  }

  /**
   * Fetch corporation information
   * @param corporationId Corporation ID
   */
  async fetchCorporation(corporationId: number): Promise<any> {
    return this.fetch(`/corporations/${corporationId}/`);
  }

  /**
   * Fetch alliance information
   * @param allianceId Alliance ID
   */
  async fetchAlliance(allianceId: number): Promise<any> {
    return this.fetch(`/alliances/${allianceId}/`);
  }

  /**
   * Fetch type information (ships, modules, etc.)
   * @param typeId The type ID
   */
  async fetchType(typeId: number): Promise<any> {
    return this.fetch(`/universe/types/${typeId}/`);
  }

  /**
   * Fetch solar system information
   * @param systemId Solar system ID
   */
  async fetchSolarSystem(systemId: number): Promise<any> {
    return this.fetch(`/universe/systems/${systemId}/`);
  }

  /**
   * Clear the cache for a specific endpoint
   * @param endpoint The endpoint to clear cache for
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
