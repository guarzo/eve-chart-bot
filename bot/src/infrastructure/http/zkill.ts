/**
 * ZKillboard API Client
 *
 * API Documentation: https://zkillboard.com/api/
 *
 * Features:
 * - Rate limiting with exponential backoff
 * - Automatic retries with increasing timeouts
 * - Pagination support for all list endpoints
 * - Detailed error logging
 * - Response validation
 *
 * Rate Limiting:
 * - 20 requests per minute
 * - Minimum 3s delay between requests
 * - Exponential backoff on errors
 * - Maximum 60s delay between requests
 * - Maximum 3 retries per request
 * - Timeout starts at 15s, increases with retries up to 45s
 *
 * Example URLs:
 * - Character Kills: https://zkillboard.com/api/kills/characterID/268946627/page/1/
 * - Character Losses: https://zkillboard.com/api/losses/characterID/268946627/page/1/
 * - Corporation Kills: https://zkillboard.com/api/kills/corporationID/123456789/
 * - System Kills: https://zkillboard.com/api/kills/systemID/30000142/
 *
 * Note: The API returns results in reverse chronological order (newest first).
 * Each page typically contains 100 results.
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../lib/logger';
import { timerManager } from '../../utils/timerManager';

// Rate limiting configuration
const RATE_LIMIT = {
  requestsPerMinute: 20, // More conservative than zKillboard's documented rate limit
  minDelay: 3000, // Minimum delay between requests (3 seconds)
  maxDelay: 60000, // Maximum delay between requests (60 seconds)
  backoffFactor: 2, // More aggressive exponential backoff
  maxRetries: 3, // Maximum number of retries per request
  initialTimeout: 15000, // Initial timeout of 15 seconds
  maxTimeout: 45000, // Maximum timeout of 45 seconds
};

/**
 * Client for interacting with ZKillboard API
 */
export class ZKillboardClient {
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private lastRequestTime: number = 0;
  private currentDelay: number = RATE_LIMIT.minDelay;
  private consecutiveErrors: number = 0;
  private currentTimeout: number = RATE_LIMIT.initialTimeout;

  constructor() {
    this.baseUrl = 'https://zkillboard.com/api';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: RATE_LIMIT.initialTimeout,
      headers: {
        'User-Agent': 'EVE-Chart-Bot/1.0',
        Accept: 'application/json',
      },
    });
  }

  private async rateLimit(signal?: AbortSignal): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // If we've had consecutive errors, use exponential backoff
    if (this.consecutiveErrors > 0) {
      this.currentDelay = Math.min(
        RATE_LIMIT.maxDelay,
        RATE_LIMIT.minDelay * Math.pow(RATE_LIMIT.backoffFactor, this.consecutiveErrors)
      );
      // Also increase timeout with each error
      this.currentTimeout = Math.min(
        RATE_LIMIT.maxTimeout,
        RATE_LIMIT.initialTimeout * Math.pow(RATE_LIMIT.backoffFactor, this.consecutiveErrors)
      );
    } else {
      // Reset delays on successful requests
      this.currentDelay = RATE_LIMIT.minDelay;
      this.currentTimeout = RATE_LIMIT.initialTimeout;
    }

    // Ensure minimum time between requests
    if (timeSinceLastRequest < this.currentDelay) {
      const waitTime = this.currentDelay - timeSinceLastRequest;
      logger.debug(`Rate limiting: waiting ${waitTime}ms before next request`);

      try {
        await timerManager.delay(waitTime, signal);
      } catch (error) {
        throw new Error('Rate limiting aborted');
      }
    }

    this.lastRequestTime = Date.now();
  }

  private async fetch<T>(endpoint: string, retryCount = 0, signal?: AbortSignal): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    logger.debug(`Making request to zKillboard: ${url}`);

    // Check if already aborted
    if (signal?.aborted) {
      throw new Error('Request aborted');
    }

    try {
      await this.rateLimit(signal);

      // Update timeout for this request
      this.client.defaults.timeout = this.currentTimeout;

      // Create a managed abort controller for this request
      const requestAbortController = timerManager.createAbortController();

      // Link to parent signal if provided
      if (signal) {
        const abortHandler = () => requestAbortController.abort();
        signal.addEventListener('abort', abortHandler, { once: true });
        // Clean up the listener when request completes
        requestAbortController.signal.addEventListener(
          'abort',
          () => {
            signal.removeEventListener('abort', abortHandler);
          },
          { once: true }
        );
      }

      try {
        const response = await this.client.get<T>(endpoint, {
          signal: requestAbortController.signal,
        });
        // Remove controller from management after successful request
        timerManager.removeAbortController(requestAbortController);
        this.consecutiveErrors = 0; // Reset error count on success
        return response.data;
      } catch (error) {
        // Remove controller from management on error
        timerManager.removeAbortController(requestAbortController);
        throw error;
      }
    } catch (error: any) {
      this.consecutiveErrors++;
      const errorDetails = {
        url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        timeout: error.code === 'ECONNABORTED' ? this.currentTimeout : undefined,
        error: error.message,
        consecutiveErrors: this.consecutiveErrors,
        currentDelay: this.currentDelay,
        currentTimeout: this.currentTimeout,
        retryCount,
        isTimeout: error.code === 'ECONNABORTED',
        isNetworkError: error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET',
        isRateLimit: error.response?.status === 429,
        isServerError: error.response?.status >= 500,
        isClientError: error.response?.status >= 400 && error.response?.status < 500,
      };

      // Log different error types with appropriate severity
      if (error.response?.status === 429) {
        logger.warn(`ZKillboard rate limit hit:`, errorDetails);
      } else if (error.response?.status >= 500) {
        logger.error(`ZKillboard server error:`, errorDetails);
      } else if (error.code === 'ECONNABORTED') {
        logger.error(`ZKillboard request timeout:`, errorDetails);
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
        logger.error(`ZKillboard connection error:`, errorDetails);
      } else {
        logger.error(`ZKillboard request failed:`, errorDetails);
      }

      // Retry logic
      if (retryCount < RATE_LIMIT.maxRetries) {
        const nextRetry = retryCount + 1;
        logger.info(
          `Retrying request to ${endpoint} (attempt ${nextRetry}/${
            RATE_LIMIT.maxRetries
          }) - Last error: ${error.response?.status || error.code}`
        );
        return this.fetch(endpoint, nextRetry, signal);
      }

      throw error;
    }
  }

  /**
   * Get a single killmail by ID
   * @param killId - The killmail ID to fetch
   * @returns The killmail data or null if not found
   *
   * Note: This method will retry up to 3 times with exponential backoff
   * if the request fails.
   */
  public async getKillmail(killId: number): Promise<any> {
    const response = await this.fetch<Record<string, any>>(`killID/${killId}/`);
    logger.debug(`ZKillboard response for killmail ${killId}:`, response);

    // Handle both array and object responses
    if (Array.isArray(response)) {
      return response[0] || null;
    }

    // The response might be wrapped in an object with the killID as the key
    const killData = response[killId.toString()] || response;
    if (!killData || typeof killData !== 'object') {
      logger.warn(`Invalid kill data format for killmail ${killId}`, {
        responseType: typeof response,
        isArray: Array.isArray(response),
        responseKeys: Object.keys(response),
      });
      return null;
    }

    return killData;
  }

  /**
   * Get kills for a character
   * @param characterId - The EVE character ID
   * @param page - The page number to fetch (default: 1)
   * @returns Array of killmails for the character
   *
   * Note: The API returns kills in reverse chronological order (newest first).
   * Each page typically contains 100 killmails.
   *
   * Example URL: https://zkillboard.com/api/kills/characterID/268946627/page/1/
   */
  public async getCharacterKills(characterId: number, page: number = 1): Promise<any[]> {
    try {
      const response = await this.fetch<any[]>(`kills/characterID/${characterId}/page/${page}/`);
      logger.debug(`ZKillboard response for character ${characterId} page ${page}:`, response);
      return response;
    } catch (error) {
      logger.error(`Error fetching kills for character ${characterId} page ${page}:`, error);
      throw error;
    }
  }

  /**
   * Get losses for a character
   * @param characterId - The EVE character ID
   * @param page - The page number to fetch (default: 1)
   * @returns Array of losses for the character
   *
   * Note: The API returns losses in reverse chronological order (newest first).
   * Each page typically contains 100 losses.
   *
   * Example URL: https://zkillboard.com/api/losses/characterID/268946627/page/1/
   */
  public async getCharacterLosses(characterId: number, page: number = 1): Promise<any[]> {
    try {
      const response = await this.fetch<any[]>(`losses/characterID/${characterId}/page/${page}/`);
      logger.debug(`ZKillboard response for character ${characterId} page ${page}:`, response);
      return response;
    } catch (error) {
      logger.error(`Error fetching losses for character ${characterId} page ${page}:`, error);
      throw error;
    }
  }

  /**
   * Get kills for a corporation
   */
  public async getCorporationKills(corporationId: number): Promise<any[]> {
    return this.fetch(`kills/corporationID/${corporationId}/`);
  }

  /**
   * Get losses for a corporation
   */
  public async getCorporationLosses(corporationId: number): Promise<any[]> {
    return this.fetch(`losses/corporationID/${corporationId}/`);
  }

  /**
   * Get kills in a system
   */
  public async getSystemKills(systemId: number): Promise<any[]> {
    return this.fetch(`kills/systemID/${systemId}/`);
  }

  /**
   * Clean up resources and cancel any pending operations
   */
  public cleanup(): void {
    // Cleanup is now handled by the TimerManager
    logger.debug('ZKillboardClient cleanup called - managed by TimerManager');
  }
}
