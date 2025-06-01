import { UnifiedESIClient } from "../infrastructure/http/UnifiedESIClient";
import { CacheRedisAdapter } from "../cache/CacheRedisAdapter";
import { logger } from "../lib/logger";
import { INTERNAL_CONFIG } from "../config";

/**
 * Service for interacting with EVE Online's ESI API
 * Provides caching and error handling around ESI data
 */
export class ESIService {
  private esiClient: UnifiedESIClient;
  private cache: CacheRedisAdapter;

  /**
   * Create a new ESI service
   */
  constructor() {
    // Initialize the ESI client with Redis caching
    this.cache = new CacheRedisAdapter(INTERNAL_CONFIG.REDIS_URL);
    this.esiClient = new UnifiedESIClient({}, this.cache);
  }

  /**
   * Fetch killmail data with caching
   */
  async getKillmail(killmailId: number, hash: string): Promise<any> {
    try {
      return await this.esiClient.fetchKillmail(killmailId, hash);
    } catch (error) {
      logger.error(`Error fetching killmail ${killmailId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch character information with caching
   */
  async getCharacter(characterId: number): Promise<any> {
    try {
      return await this.esiClient.fetchCharacter(characterId);
    } catch (error) {
      logger.error(`Error fetching character ${characterId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch corporation information with caching
   */
  async getCorporation(corporationId: number): Promise<any> {
    try {
      return await this.esiClient.fetchCorporation(corporationId);
    } catch (error) {
      logger.error(`Error fetching corporation ${corporationId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch alliance information with caching
   */
  async getAlliance(allianceId: number): Promise<any> {
    try {
      return await this.esiClient.fetchAlliance(allianceId);
    } catch (error) {
      logger.error(`Error fetching alliance ${allianceId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch ship type information with caching
   */
  async getShipType(typeId: number): Promise<any> {
    try {
      return await this.esiClient.fetchType(typeId);
    } catch (error) {
      logger.error(`Error fetching type ${typeId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch solar system information with caching
   */
  async getSolarSystem(systemId: number): Promise<any> {
    try {
      return await this.esiClient.fetchSolarSystem(systemId);
    } catch (error) {
      logger.error(`Error fetching system ${systemId}:`, error);
      throw error;
    }
  }

  /**
   * Map a list of ship type IDs to their names
   * Uses batched requests and caching to optimize performance
   */
  async getShipTypeNames(typeIds: number[]): Promise<Record<number, string>> {
    try {
      // Deduplicate type IDs
      const uniqueTypeIds = Array.from(new Set(typeIds));

      // Create caching key for this list
      const cacheKey = `ship-types-${uniqueTypeIds.sort().join("-")}`;

      // Try to get from cache
      const cached = await this.cache.get<Record<number, string>>(cacheKey);
      if (cached) {
        return cached;
      }

      // Not in cache, need to fetch from ESI
      const result: Record<number, string> = {};

      // Process in batches of 20 to avoid rate limits
      const batchSize = 20;
      for (let i = 0; i < uniqueTypeIds.length; i += batchSize) {
        const batch = uniqueTypeIds.slice(i, i + batchSize);

        // Fetch each type in parallel
        const promises = batch.map((typeId) => this.getShipType(typeId));
        const types = await Promise.all(promises);

        // Map type IDs to names
        for (let j = 0; j < batch.length; j++) {
          const typeId = batch[j];
          const type = types[j];
          result[typeId] = type?.name || `Unknown Type ${typeId}`;
        }
      }

      // Cache the result for future use
      await this.cache.set(cacheKey, result, 60 * 60 * 24); // 24 hour cache for ship types

      return result;
    } catch (error) {
      logger.error("Error mapping ship type IDs to names:", error);
      throw error;
    }
  }

  /**
   * Map a list of corporation IDs to their names and tickers
   */
  async getCorporationDetails(
    corpIds: number[]
  ): Promise<Record<number, { name: string; ticker: string }>> {
    try {
      // Deduplicate corp IDs
      const uniqueCorpIds = Array.from(new Set(corpIds));

      // Create caching key for this list
      const cacheKey = `corp-details-${uniqueCorpIds.sort().join("-")}`;

      // Try to get from cache
      const cached = await this.cache.get<
        Record<number, { name: string; ticker: string }>
      >(cacheKey);
      if (cached) {
        return cached;
      }

      // Not in cache, need to fetch from ESI
      const result: Record<number, { name: string; ticker: string }> = {};

      // Process in batches of 20 to avoid rate limits
      const batchSize = 20;
      for (let i = 0; i < uniqueCorpIds.length; i += batchSize) {
        const batch = uniqueCorpIds.slice(i, i + batchSize);

        // Fetch each corporation in parallel
        const promises = batch.map((corpId) => this.getCorporation(corpId));
        const corps = await Promise.all(promises);

        // Map corporation IDs to names and tickers
        for (let j = 0; j < batch.length; j++) {
          const corpId = batch[j];
          const corp = corps[j];
          result[corpId] = {
            name: corp?.name || `Unknown Corp ${corpId}`,
            ticker: corp?.ticker || "????",
          };
        }
      }

      // Cache the result for future use
      await this.cache.set(cacheKey, result, 60 * 60 * 24); // 24 hour cache for corporation details

      return result;
    } catch (error) {
      logger.error("Error mapping corporation IDs to details:", error);
      throw error;
    }
  }
}
