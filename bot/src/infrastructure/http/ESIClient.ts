import { AxiosRequestConfig } from 'axios';

/**
 * Configuration options for the ESI client
 */
export interface ESIClientConfig {
  /** Base URL for the ESI API */
  baseUrl?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** User-Agent string to identify the client */
  userAgent?: string;
  /** Cache TTL in seconds */
  cacheTtl?: number;
  /** Maximum number of retries for failed requests */
  maxRetries?: number;
  /** Initial retry delay in milliseconds */
  initialRetryDelay?: number;
}

/**
 * Interface for the unified ESI client
 */
export interface IESIClient {
  /**
   * Fetch data from the ESI API
   * @param endpoint The ESI endpoint to call
   * @param options Additional request options
   * @returns The response data
   */
  fetch<T>(endpoint: string, options?: AxiosRequestConfig): Promise<T>;

  /**
   * Fetch killmail data from ESI
   * @param killmailId The ID of the killmail
   * @param hash The killmail hash
   * @returns The killmail data
   */
  fetchKillmail(killmailId: number, hash: string): Promise<any>;

  /**
   * Fetch character information
   * @param characterId The character ID
   * @returns Character information
   */
  fetchCharacter(characterId: number): Promise<any>;

  /**
   * Fetch corporation information
   * @param corporationId The corporation ID
   * @returns Corporation information
   */
  fetchCorporation(corporationId: number): Promise<any>;

  /**
   * Fetch alliance information
   * @param allianceId The alliance ID
   * @returns Alliance information
   */
  fetchAlliance(allianceId: number): Promise<any>;

  /**
   * Fetch solar system information
   * @param systemId The solar system ID
   * @returns Solar system information
   */
  fetchSolarSystem(systemId: number): Promise<any>;

  /**
   * Fetch type information (ships, modules, etc.)
   * @param typeId The type ID
   * @returns Type information
   */
  fetchType(typeId: number): Promise<any>;

  /**
   * Clear the cache for a specific endpoint
   * @param endpoint Optional endpoint to clear cache for. If not provided, clears all cache.
   */
  clearCache(endpoint?: string): Promise<void>;
}
