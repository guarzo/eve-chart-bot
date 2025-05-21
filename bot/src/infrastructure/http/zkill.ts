/**
 * ZKillboard API Client
 *
 * API Documentation: https://zkillboard.com/api/
 *
 * Example URLs:
 * - Character Kills: https://zkillboard.com/api/kills/characterID/268946627/
 * - Character Losses: https://zkillboard.com/api/losses/characterID/268946627/
 * - Corporation Kills: https://zkillboard.com/api/kills/corporationID/123456789/
 * - System Kills: https://zkillboard.com/api/kills/systemID/30000142/
 *
 * Note: The API does not support the 'limit' parameter anymore due to abuse.
 * All endpoints return the most recent kills/losses.
 */

import axios, { AxiosInstance } from "axios";
import { logger } from "../../lib/logger";

/**
 * Configuration for the ZKillboard client
 */
export interface ZKillboardClientConfig {
  /** Base URL for the ZKillboard API */
  baseUrl?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** User-Agent string to identify the client */
  userAgent?: string;
}

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
  private lastRequestTime: number = 0;
  private currentDelay: number = RATE_LIMIT.minDelay;
  private consecutiveErrors: number = 0;
  private currentTimeout: number = RATE_LIMIT.initialTimeout;

  /**
   * Create a new ZKillboard client
   * @param config Optional configuration for the client
   */
  constructor(config: ZKillboardClientConfig = {}) {
    this.client = axios.create({
      baseURL: config.baseUrl || "https://zkillboard.com/api/",
      timeout: RATE_LIMIT.initialTimeout,
      headers: {
        "User-Agent": config.userAgent || "EVE-Chart-Bot/1.0",
      },
    });

    // Log the client configuration
    logger.debug("ZKillboardClient initialized with config:", {
      baseUrl: this.client.defaults.baseURL,
      timeout: this.client.defaults.timeout,
      userAgent: this.client.defaults.headers["User-Agent"],
    });
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // If we've had consecutive errors, use exponential backoff
    if (this.consecutiveErrors > 0) {
      this.currentDelay = Math.min(
        RATE_LIMIT.maxDelay,
        RATE_LIMIT.minDelay *
          Math.pow(RATE_LIMIT.backoffFactor, this.consecutiveErrors)
      );
      // Also increase timeout with each error
      this.currentTimeout = Math.min(
        RATE_LIMIT.maxTimeout,
        RATE_LIMIT.initialTimeout *
          Math.pow(RATE_LIMIT.backoffFactor, this.consecutiveErrors)
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
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  private async fetch<T>(endpoint: string, retryCount = 0): Promise<T> {
    const startTime = Date.now();
    try {
      await this.rateLimit();

      // Update timeout for this request
      this.client.defaults.timeout = this.currentTimeout;

      const response = await this.client.get<T>(endpoint);
      this.consecutiveErrors = 0; // Reset error count on success

      const duration = Date.now() - startTime;
      logger.debug(
        `ZKillboard request to ${endpoint} completed in ${duration}ms`
      );

      return response.data;
    } catch (error: any) {
      this.consecutiveErrors++;
      const duration = Date.now() - startTime;

      // Log the error with essential context
      logger.error(
        `ZKillboard request to ${endpoint} failed after ${duration}ms:`,
        {
          error: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers,
          consecutiveErrors: this.consecutiveErrors,
          currentDelay: this.currentDelay,
          currentTimeout: this.currentTimeout,
          retryCount,
        }
      );

      // Retry logic
      if (retryCount < RATE_LIMIT.maxRetries) {
        const nextRetry = retryCount + 1;
        logger.info(
          `Retrying request to ${endpoint} (attempt ${nextRetry}/${RATE_LIMIT.maxRetries})`
        );
        return this.fetch(endpoint, nextRetry);
      }

      throw error;
    }
  }

  /**
   * Get a single killmail by ID
   */
  public async getKillmail(killId: number): Promise<any> {
    try {
      const response = await this.fetch<Record<string, any>>(
        `killID/${killId}/`
      );
      logger.debug(`ZKillboard response for killmail ${killId}:`, response);

      // Handle both array and object responses
      if (Array.isArray(response)) {
        return response[0] || {};
      }

      // The response might be wrapped in an object with the killID as the key
      const killData = response[killId.toString()] || response;
      if (!killData || typeof killData !== "object") {
        logger.warn(`Invalid kill data format for killmail ${killId}`);
        return null;
      }

      return killData;
    } catch (error: any) {
      logger.error(
        `ZKillboard request to killID/${killId}/ failed after ${
          error.response?.config?.timeout || "unknown"
        }ms:`,
        {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers,
        }
      );
      throw error;
    }
  }

  /**
   * Get kills for a character
   */
  public async getCharacterKills(characterId: number): Promise<any[]> {
    try {
      const response = await this.fetch<Record<string, any>>(
        `kills/characterID/${characterId}/`
      );
      logger.debug(
        `ZKillboard response for character ${characterId}:`,
        response
      );

      // Handle both array and object responses
      if (Array.isArray(response)) {
        return response;
      }

      // Convert object response to array
      const kills = Object.values(response).filter((kill) => {
        const isValid =
          kill &&
          typeof kill === "object" &&
          kill.killmail_id &&
          kill.zkb &&
          kill.zkb.hash;
        if (!isValid) {
          logger.debug(`Invalid kill entry:`, {
            hasKillmailId: !!kill?.killmail_id,
            hasZkb: !!kill?.zkb,
            hasHash: !!kill?.zkb?.hash,
            keys: kill ? Object.keys(kill) : [],
          });
        }
        return isValid;
      });

      return kills;
    } catch (error: any) {
      logger.error(
        `ZKillboard request to kills/characterID/${characterId}/ failed after ${
          error.response?.config?.timeout || "unknown"
        }ms:`,
        {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers,
        }
      );
      throw error;
    }
  }

  /**
   * Get losses for a character
   */
  public async getCharacterLosses(characterId: number): Promise<any[]> {
    try {
      const response = await this.fetch<Record<string, any>>(
        `losses/characterID/${characterId}/`
      );
      logger.debug(
        `ZKillboard response for character ${characterId} losses:`,
        response
      );

      // Handle both array and object responses
      if (Array.isArray(response)) {
        return response;
      }

      // Convert object response to array
      const losses = Object.values(response).filter((loss) => {
        const isValid =
          loss &&
          typeof loss === "object" &&
          loss.killmail_id &&
          loss.zkb &&
          loss.zkb.hash;
        if (!isValid) {
          logger.debug(`Invalid loss entry:`, {
            hasKillmailId: !!loss?.killmail_id,
            hasZkb: !!loss?.zkb,
            hasHash: !!loss?.zkb?.hash,
            keys: loss ? Object.keys(loss) : [],
          });
        }
        return isValid;
      });

      return losses;
    } catch (error: any) {
      logger.error(
        `ZKillboard request to losses/characterID/${characterId}/ failed after ${
          error.response?.config?.timeout || "unknown"
        }ms:`,
        {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers,
        }
      );
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
}
