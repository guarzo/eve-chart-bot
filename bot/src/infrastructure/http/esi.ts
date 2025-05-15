import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { logger } from "../../lib/logger";
import { retry, retryStrategies } from "../utils/retry";

/**
 * Configuration for the ESI client
 */
export interface ESIClientConfig {
  /** Base URL for the ESI API */
  baseUrl?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** User-Agent string to identify the client */
  userAgent?: string;
}

/**
 * Client for interacting with EVE Online's ESI API
 */
export class ESIClient {
  private readonly client: AxiosInstance;
  private readonly config: Required<ESIClientConfig>;

  /**
   * Create a new ESI client
   * @param config Optional configuration for the client
   */
  constructor(config: ESIClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || "https://esi.evetech.net/latest",
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
   * Fetch data from the ESI API with retry capabilities
   * @param endpoint The ESI endpoint to call
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
        logger.debug(`Fetching ESI data from ${url}`);
        const response = await this.client.get<T>(url, options);
        return response.data;
      } catch (error) {
        logger.error(
          `ESI request failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    }, 3);
  }

  /**
   * Fetch killmail data from ESI
   * @param killmailId The ID of the killmail
   * @param hash The killmail hash
   * @returns The killmail data
   */
  async fetchKillmail(killmailId: number, hash: string): Promise<any> {
    return this.fetch(`/killmails/${killmailId}/${hash}/`);
  }

  /**
   * Fetch character information
   * @param characterId The character ID
   * @returns Character information
   */
  async fetchCharacter(characterId: number): Promise<any> {
    return this.fetch(`/characters/${characterId}/`);
  }

  /**
   * Fetch corporation information
   * @param corporationId The corporation ID
   * @returns Corporation information
   */
  async fetchCorporation(corporationId: number): Promise<any> {
    return this.fetch(`/corporations/${corporationId}/`);
  }

  /**
   * Fetch alliance information
   * @param allianceId The alliance ID
   * @returns Alliance information
   */
  async fetchAlliance(allianceId: number): Promise<any> {
    return this.fetch(`/alliances/${allianceId}/`);
  }

  /**
   * Fetch solar system information
   * @param systemId The solar system ID
   * @returns Solar system information
   */
  async fetchSolarSystem(systemId: number): Promise<any> {
    return this.fetch(`/universe/systems/${systemId}/`);
  }

  /**
   * Fetch type information (ships, modules, etc.)
   * @param typeId The type ID
   * @returns Type information
   */
  async fetchType(typeId: number): Promise<any> {
    return this.fetch(`/universe/types/${typeId}/`);
  }
}
