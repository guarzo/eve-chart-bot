import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { logger } from '../../lib/logger';
import { CacheAdapter } from '../../cache/CacheAdapter';
import { CacheRedisAdapter } from '../../cache/CacheRedisAdapter';
import { ESIClientConfig, IESIClient } from './ESIClient';
import { RateLimiter } from '../../shared/performance/rateLimiter';
import { rateLimiterManager } from '../../shared/performance/RateLimiterManager';
import { errorHandler, ExternalServiceError } from '../../shared/errors';
import { ValidatedConfiguration } from '../../config/validated';

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
      baseUrl: config.baseUrl ?? ValidatedConfiguration.apis.esi.baseUrl,
      timeout: config.timeout ?? ValidatedConfiguration.http.timeout,
      userAgent: config.userAgent ?? 'EVE-Chart-Bot/1.0',
      cacheTtl: config.cacheTtl ?? ValidatedConfiguration.redis.cacheTtl,
      maxRetries: config.maxRetries ?? ValidatedConfiguration.http.maxRetries,
      initialRetryDelay: config.initialRetryDelay ?? ValidatedConfiguration.http.initialRetryDelay,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'User-Agent': this.config.userAgent,
        Accept: 'application/json',
      },
    });

    this.cache = cache ?? new CacheRedisAdapter(ValidatedConfiguration.redis.url, this.config.cacheTtl);

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
    const correlationId = errorHandler.createCorrelationId();
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const cacheKey = this.buildCacheKey(url, options.params ?? {});

    try {
      // Try to get from cache first
      const cachedData = await this.cache.get<T>(cacheKey);
      if (cachedData) {
        logger.debug('ESI cache hit', { 
          correlationId, 
          url, 
          cacheKey 
        });
        return cachedData;
      }

      // Not in cache, fetch from API with retry logic
      logger.debug('ESI cache miss, fetching from API', { 
        correlationId, 
        url 
      });

      // Apply rate limiting if configured
      if (this.rateLimiter && options.signal) {
        await this.rateLimiter.wait(options.signal as AbortSignal);
      } else if (this.rateLimiter) {
        await this.rateLimiter.wait();
      }

      const data = await errorHandler.withRetry(
        async () => {
          const response = await this.client.get<T>(url, options);
          return response.data;
        },
        this.config.maxRetries,
        this.config.initialRetryDelay,
        {
          operation: 'esi.fetch',
          metadata: { 
            endpoint: url, 
            baseUrl: this.config.baseUrl,
            hasParams: Object.keys(options.params ?? {}).length > 0
          },
        }
      );

      if (!data) {
        throw ExternalServiceError.serviceUnavailable(
          'ESI',
          {
            correlationId,
            operation: 'esi.fetch',
            metadata: { 
              endpoint: url,
              retriesAttempted: this.config.maxRetries
            },
          }
        );
      }

      // Cache the response
      await this.cache.set(cacheKey, data, this.config.cacheTtl);

      logger.debug('Successfully fetched and cached ESI data', {
        correlationId,
        url,
        cacheKey,
        dataSize: JSON.stringify(data).length,
      });

      return data;
    } catch (error) {
      throw errorHandler.handleExternalServiceError(
        error,
        'ESI',
        url
      );
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
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      logger.debug('Fetching killmail data', {
        correlationId,
        killmailId,
        hash,
      });
      
      return await this.fetch(`/killmails/${killmailId}/${hash}/`);
    } catch (error) {
      throw errorHandler.handleExternalServiceError(
        error,
        'ESI',
        `/killmails/${killmailId}/${hash}/`
      );
    }
  }

  /**
   * Fetch character information
   */
  async fetchCharacter(characterId: number): Promise<any> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      logger.debug('Fetching character data', {
        correlationId,
        characterId,
      });
      
      return await this.fetch(`/characters/${characterId}/`);
    } catch (error) {
      throw errorHandler.handleExternalServiceError(
        error,
        'ESI',
        `/characters/${characterId}/`
      );
    }
  }

  /**
   * Fetch corporation information
   */
  async fetchCorporation(corporationId: number): Promise<any> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      logger.debug('Fetching corporation data', {
        correlationId,
        corporationId,
      });
      
      return await this.fetch(`/corporations/${corporationId}/`);
    } catch (error) {
      throw errorHandler.handleExternalServiceError(
        error,
        'ESI',
        `/corporations/${corporationId}/`
      );
    }
  }

  /**
   * Fetch alliance information
   */
  async fetchAlliance(allianceId: number): Promise<any> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      logger.debug('Fetching alliance data', {
        correlationId,
        allianceId,
      });
      
      return await this.fetch(`/alliances/${allianceId}/`);
    } catch (error) {
      throw errorHandler.handleExternalServiceError(
        error,
        'ESI',
        `/alliances/${allianceId}/`
      );
    }
  }

  /**
   * Fetch solar system information
   */
  async fetchSolarSystem(systemId: number): Promise<any> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      logger.debug('Fetching solar system data', {
        correlationId,
        systemId,
      });
      
      return await this.fetch(`/universe/systems/${systemId}/`);
    } catch (error) {
      throw errorHandler.handleExternalServiceError(
        error,
        'ESI',
        `/universe/systems/${systemId}/`
      );
    }
  }

  /**
   * Fetch type information
   */
  async fetchType(typeId: number): Promise<any> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      logger.debug('Fetching type data', {
        correlationId,
        typeId,
      });
      
      return await this.fetch(`/universe/types/${typeId}/`);
    } catch (error) {
      throw errorHandler.handleExternalServiceError(
        error,
        'ESI',
        `/universe/types/${typeId}/`
      );
    }
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
