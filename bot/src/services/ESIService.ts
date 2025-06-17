import { UnifiedESIClient } from '../infrastructure/http/UnifiedESIClient';
import { CacheRedisAdapter } from '../cache/CacheRedisAdapter';
import { logger } from '../lib/logger';
import { ValidatedConfiguration as Configuration } from '../config/validated';
import { errorHandler } from '../shared/errors/ErrorHandler';

// Simple validation error class for testing compatibility
class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public context?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }

  static fieldRequired(field: string, context?: any): ValidationError {
    return new ValidationError(`Missing required field: ${field}`, field, context);
  }

  static invalidFormat(field: string, expectedFormat: string, actualValue: string, context?: any): ValidationError {
    return new ValidationError(
      `Invalid format for ${field}: expected ${expectedFormat}, got ${actualValue}`,
      field,
      context
    );
  }
}

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
    this.cache = new CacheRedisAdapter(Configuration.redis.url, Configuration.redis.cacheTtl);
    this.esiClient = new UnifiedESIClient({}, this.cache);
  }

  /**
   * Fetch killmail data with caching
   */
  async getKillmail(killmailId: number, hash: string): Promise<any> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!killmailId || killmailId <= 0) {
        throw ValidationError.invalidFormat('killmailId', 'positive integer', killmailId?.toString(), {
          correlationId,
          operation: 'esi.getKillmail',
          metadata: { hash },
        });
      }

      if (!hash || typeof hash !== 'string') {
        throw ValidationError.fieldRequired('hash', {
          correlationId,
          operation: 'esi.getKillmail',
          metadata: { killmailId },
        });
      }

      logger.debug('Fetching killmail from ESI', {
        correlationId,
        killmailId,
        hash,
      });

      const result = await errorHandler.withRetry(
        async () => {
          return await this.esiClient.fetchKillmail(killmailId, hash);
        },
        3,
        1000,
        {
          correlationId,
          operation: 'esi.service.fetchKillmail',
          metadata: { killmailId, hash },
        }
      );

      logger.debug('Successfully fetched killmail from ESI', {
        correlationId,
        killmailId,
        hasData: !!result,
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'getKillmail',
        metadata: { killmailId, hash },
      });
    }
  }

  /**
   * Fetch character information with caching
   */
  async getCharacter(characterId: number): Promise<any> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!characterId || characterId <= 0) {
        throw ValidationError.invalidFormat('characterId', 'positive integer', characterId?.toString(), {
          correlationId,
          operation: 'esi.getCharacter',
        });
      }

      logger.debug('Fetching character from ESI', {
        correlationId,
        characterId,
      });

      const result = await errorHandler.withRetry(
        async () => {
          return await this.esiClient.fetchCharacter(characterId);
        },
        3,
        1000,
        {
          correlationId,
          operation: 'esi.service.fetchCharacter',
          metadata: { characterId },
        }
      );

      logger.debug('Successfully fetched character from ESI', {
        correlationId,
        characterId,
        characterName: result?.name || 'unknown',
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'getCharacter',
        metadata: { characterId },
      });
    }
  }

  /**
   * Fetch corporation information with caching
   */
  async getCorporation(corporationId: number): Promise<any> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!corporationId || corporationId <= 0) {
        throw ValidationError.invalidFormat('corporationId', 'positive integer', corporationId?.toString(), {
          correlationId,
          operation: 'esi.getCorporation',
        });
      }

      logger.debug('Fetching corporation from ESI', {
        correlationId,
        corporationId,
      });

      const result = await errorHandler.withRetry(
        async () => {
          return await this.esiClient.fetchCorporation(corporationId);
        },
        3,
        1000,
        {
          correlationId,
          operation: 'esi.service.fetchCorporation',
          metadata: { corporationId },
        }
      );

      logger.debug('Successfully fetched corporation from ESI', {
        correlationId,
        corporationId,
        corporationName: result?.name || 'unknown',
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'getCorporation',
        metadata: { corporationId },
      });
    }
  }

  /**
   * Fetch alliance information with caching
   */
  async getAlliance(allianceId: number): Promise<any> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!allianceId || allianceId <= 0) {
        throw ValidationError.invalidFormat('allianceId', 'positive integer', allianceId?.toString(), {
          correlationId,
          operation: 'esi.getAlliance',
        });
      }

      logger.debug('Fetching alliance from ESI', {
        correlationId,
        allianceId,
      });

      const result = await errorHandler.withRetry(
        async () => {
          return await this.esiClient.fetchAlliance(allianceId);
        },
        3,
        1000,
        {
          correlationId,
          operation: 'esi.service.fetchAlliance',
          metadata: { allianceId },
        }
      );

      logger.debug('Successfully fetched alliance from ESI', {
        correlationId,
        allianceId,
        allianceName: result?.name || 'unknown',
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'getAlliance',
        metadata: { allianceId },
      });
    }
  }

  /**
   * Fetch ship type information with caching
   */
  async getShipType(typeId: number): Promise<any> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!typeId || typeId <= 0) {
        throw ValidationError.invalidFormat('typeId', 'positive integer', typeId?.toString(), {
          correlationId,
          operation: 'esi.getShipType',
        });
      }

      logger.debug('Fetching ship type from ESI', {
        correlationId,
        typeId,
      });

      const result = await errorHandler.withRetry(
        async () => {
          return await this.esiClient.fetchType(typeId);
        },
        3,
        1000,
        {
          correlationId,
          operation: 'esi.service.fetchType',
          metadata: { typeId },
        }
      );

      logger.debug('Successfully fetched ship type from ESI', {
        correlationId,
        typeId,
        typeName: result?.name || 'unknown',
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'getShipType',
        metadata: { typeId },
      });
    }
  }

  /**
   * Fetch solar system information with caching
   */
  async getSolarSystem(systemId: number): Promise<any> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!systemId || systemId <= 0) {
        throw ValidationError.invalidFormat('systemId', 'positive integer', systemId?.toString(), {
          correlationId,
          operation: 'esi.getSolarSystem',
        });
      }

      logger.debug('Fetching solar system from ESI', {
        correlationId,
        systemId,
      });

      const result = await errorHandler.withRetry(
        async () => {
          return await this.esiClient.fetchSolarSystem(systemId);
        },
        3,
        1000,
        {
          correlationId,
          operation: 'esi.service.fetchSolarSystem',
          metadata: { systemId },
        }
      );

      logger.debug('Successfully fetched solar system from ESI', {
        correlationId,
        systemId,
        systemName: result?.name || 'unknown',
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'getSolarSystem',
        metadata: { systemId },
      });
    }
  }

  /**
   * Map a list of ship type IDs to their names
   * Uses batched requests and caching to optimize performance
   */
  async getShipTypeNames(typeIds: number[]): Promise<Record<number, string>> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!typeIds || !Array.isArray(typeIds)) {
        throw ValidationError.fieldRequired('typeIds', {
          correlationId,
          operation: 'esi.getShipTypeNames',
        });
      }

      if (typeIds.length === 0) {
        logger.debug('Empty typeIds array provided, returning empty result', {
          correlationId,
        });
        return {};
      }

      logger.debug('Mapping ship type IDs to names', {
        correlationId,
        typeCount: typeIds.length,
      });

      // Deduplicate type IDs
      const uniqueTypeIds = Array.from(new Set(typeIds));

      // Create caching key for this list
      const cacheKey = `ship-types-${uniqueTypeIds.sort().join('-')}`;

      // Try to get from cache
      const cached = await this.cache.get<Record<number, string>>(cacheKey);
      if (cached) {
        logger.debug('Retrieved ship type names from cache', {
          correlationId,
          cachedCount: Object.keys(cached).length,
        });
        return cached;
      }

      // Not in cache, need to fetch from ESI
      const result: Record<number, string> = {};

      // Process in batches of 20 to avoid rate limits
      const batchSize = 20;
      for (let i = 0; i < uniqueTypeIds.length; i += batchSize) {
        const batch = uniqueTypeIds.slice(i, i + batchSize);

        logger.debug(
          `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueTypeIds.length / batchSize)}`,
          {
            correlationId,
            batchSize: batch.length,
          }
        );

        // Fetch each type in parallel
        const promises = batch.map(typeId => this.getShipType(typeId));
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

      logger.debug('Successfully mapped ship type IDs to names', {
        correlationId,
        mappedCount: Object.keys(result).length,
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'getShipTypeNames',
        metadata: { typeCount: typeIds?.length },
      });
    }
  }

  /**
   * Map a list of corporation IDs to their names and tickers
   */
  async getCorporationDetails(corpIds: number[]): Promise<Record<number, { name: string; ticker: string }>> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!corpIds || !Array.isArray(corpIds)) {
        throw ValidationError.fieldRequired('corpIds', {
          correlationId,
          operation: 'esi.getCorporationDetails',
        });
      }

      if (corpIds.length === 0) {
        logger.debug('Empty corpIds array provided, returning empty result', {
          correlationId,
        });
        return {};
      }

      logger.debug('Mapping corporation IDs to details', {
        correlationId,
        corpCount: corpIds.length,
      });

      // Deduplicate corp IDs
      const uniqueCorpIds = Array.from(new Set(corpIds));

      // Create caching key for this list
      const cacheKey = `corp-details-${uniqueCorpIds.sort().join('-')}`;

      // Try to get from cache
      const cached = await this.cache.get<Record<number, { name: string; ticker: string }>>(cacheKey);
      if (cached) {
        logger.debug('Retrieved corporation details from cache', {
          correlationId,
          cachedCount: Object.keys(cached).length,
        });
        return cached;
      }

      // Not in cache, need to fetch from ESI
      const result: Record<number, { name: string; ticker: string }> = {};

      // Process in batches of 20 to avoid rate limits
      const batchSize = 20;
      for (let i = 0; i < uniqueCorpIds.length; i += batchSize) {
        const batch = uniqueCorpIds.slice(i, i + batchSize);

        logger.debug(
          `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueCorpIds.length / batchSize)}`,
          {
            correlationId,
            batchSize: batch.length,
          }
        );

        // Fetch each corporation in parallel
        const promises = batch.map(corpId => this.getCorporation(corpId));
        const corps = await Promise.all(promises);

        // Map corporation IDs to names and tickers
        for (let j = 0; j < batch.length; j++) {
          const corpId = batch[j];
          const corp = corps[j];
          result[corpId] = {
            name: corp?.name || `Unknown Corp ${corpId}`,
            ticker: corp?.ticker || '????',
          };
        }
      }

      // Cache the result for future use
      await this.cache.set(cacheKey, result, 60 * 60 * 24); // 24 hour cache for corporation details

      logger.debug('Successfully mapped corporation IDs to details', {
        correlationId,
        mappedCount: Object.keys(result).length,
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'getCorporationDetails',
        metadata: { corpCount: corpIds?.length },
      });
    }
  }
}
