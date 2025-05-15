import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { logger } from "../../lib/logger";
import { retry, retryStrategies } from "../utils/retry";

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

/**
 * Client for interacting with ZKillboard API
 */
export class ZKillboardClient {
  private readonly client: AxiosInstance;
  private readonly config: Required<ZKillboardClientConfig>;

  /**
   * Create a new ZKillboard client
   * @param config Optional configuration for the client
   */
  constructor(config: ZKillboardClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || "https://zkillboard.com/api",
      timeout: config.timeout || 10000,
      userAgent: config.userAgent || "EVE-Chart-Bot/1.0",
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        "User-Agent": this.config.userAgent,
        Accept: "application/json",
      },
    });
  }

  /**
   * Fetch data from the ZKillboard API with retry capabilities
   * @param endpoint The API endpoint to call
   * @param options Additional Axios request options
   * @returns The response data
   */
  async fetch<T>(
    endpoint: string,
    options: AxiosRequestConfig = {}
  ): Promise<T> {
    const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    return retryStrategies.http(async () => {
      try {
        logger.debug(`Fetching ZKillboard data from ${url}`);
        const response = await this.client.get<T>(url, options);
        return response.data;
      } catch (error) {
        logger.error(
          `ZKillboard request failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    }, 3);
  }

  /**
   * Fetch a specific killmail by ID
   * @param killmailId The killmail ID
   * @returns The killmail data
   */
  async getKillmail(killmailId: number): Promise<any> {
    return this.fetch(`/killID/${killmailId}/`);
  }

  /**
   * Fetch recent kills for a character
   * @param characterId The character ID
   * @param limit Maximum number of kills to fetch
   * @returns Array of killmails
   */
  async getCharacterKills(
    characterId: number,
    limit: number = 50
  ): Promise<any[]> {
    return this.fetch(`/characterID/${characterId}/kills/limit/${limit}/`);
  }

  /**
   * Fetch recent losses for a character
   * @param characterId The character ID
   * @param limit Maximum number of losses to fetch
   * @returns Array of killmails
   */
  async getCharacterLosses(
    characterId: number,
    limit: number = 50
  ): Promise<any[]> {
    return this.fetch(`/characterID/${characterId}/losses/limit/${limit}/`);
  }

  /**
   * Fetch recent kills for a corporation
   * @param corporationId The corporation ID
   * @param limit Maximum number of kills to fetch
   * @returns Array of killmails
   */
  async getCorporationKills(
    corporationId: number,
    limit: number = 50
  ): Promise<any[]> {
    return this.fetch(`/corporationID/${corporationId}/kills/limit/${limit}/`);
  }

  /**
   * Fetch recent kills in a solar system
   * @param systemId The solar system ID
   * @param limit Maximum number of kills to fetch
   * @returns Array of killmails
   */
  async getSystemKills(systemId: number, limit: number = 50): Promise<any[]> {
    return this.fetch(`/systemID/${systemId}/limit/${limit}/`);
  }
}
