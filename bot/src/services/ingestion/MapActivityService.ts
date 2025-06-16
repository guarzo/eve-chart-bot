import { MapClient } from '../../infrastructure/http/MapClient';
import { CacheRedisAdapter } from '../../cache/CacheRedisAdapter';
// import { retryOperation } from '../../shared/performance/retry';
import { logger } from '../../lib/logger';
import { MapActivityResponseSchema } from '../../types/ingestion';
import { MapActivityRepository } from '../../infrastructure/repositories/MapActivityRepository';
import { MapActivity } from '../../domain/activity/MapActivity';
import { ValidatedConfiguration as Configuration } from '../../config/validated';
import { errorHandler, ExternalServiceError, ValidationError } from '../../shared/errors';

export class MapActivityService {
  private readonly map: MapClient;
  private readonly cache: CacheRedisAdapter;
  private readonly mapActivityRepository: MapActivityRepository;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    mapApiUrl: string,
    mapApiKey: string,
    redisUrl: string = 'redis://localhost:6379',
    cacheTtl: number = 300,
    maxRetries: number = 3,
    retryDelay: number = 5000
  ) {
    this.map = new MapClient(mapApiUrl, mapApiKey);
    this.cache = new CacheRedisAdapter(redisUrl, cacheTtl);
    this.mapActivityRepository = new MapActivityRepository();
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Start the map activity service
   */
  public async start(): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      logger.info('Starting map activity service...', {
        correlationId,
      });

      // Get map name from centralized configuration
      const mapName = Configuration.apis.map.name;
      if (!mapName) {
        logger.warn('MAP_NAME environment variable not set, skipping map activity ingestion', {
          correlationId,
        });
        return;
      }

      // Validate map name
      if (typeof mapName !== 'string' || mapName.trim().length === 0) {
        throw ValidationError.invalidFormat(
          'mapName',
          'non-empty string',
          mapName,
          {
            correlationId,
            operation: 'mapActivity.start',
          }
        );
      }

      // Fetch map activity data for the entire map (not per character)
      await this.ingestMapActivity(mapName, 7); // Last 7 days
      
      logger.info('Map activity service started successfully', {
        correlationId,
        mapName,
      });
    } catch (error) {
      throw errorHandler.handleError(
        error,
        {
          correlationId,
          operation: 'start',
          metadata: { mapName: Configuration.apis.map.name },
        }
      );
    }
  }

  public async ingestMapActivity(slug: string, days = 7): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      // Validate input parameters
      if (!slug || typeof slug !== 'string') {
        throw ValidationError.fieldRequired(
          'slug',
          {
            correlationId,
            operation: 'mapActivity.ingestMapActivity',
          }
        );
      }

      if (days <= 0 || days > 365) {
        throw ValidationError.invalidFormat(
          'days',
          'number between 1 and 365',
          days.toString(),
          {
            correlationId,
            operation: 'mapActivity.ingestMapActivity',
            metadata: { slug },
          }
        );
      }

      logger.info(`Ingesting map activity for ${slug} (last ${days} days)`, {
        correlationId,
        slug,
        days,
      });

      // Get map data with retry
      const mapData = await errorHandler.withRetry(
        async () => {
          const result = await this.map.getCharacterActivity(slug, days);
          if (!result) {
            throw new ExternalServiceError(
              'MAP_API',
              'No data returned from Map API',
              undefined,
              undefined,
              {
                correlationId,
                operation: 'getCharacterActivity',
                metadata: { slug, days },
              }
            );
          }
          return result;
        },
        this.maxRetries,
        this.retryDelay,
        {
          correlationId,
          operation: 'mapActivity.getCharacterActivity',
          metadata: { slug, days },
        }
      );

      if (!mapData?.data || !Array.isArray(mapData.data)) {
        logger.warn(`No valid map data available for ${slug}`, {
          correlationId,
          slug,
          hasData: !!mapData,
          dataType: typeof mapData?.data,
        });
        return;
      }

      logger.debug(`Retrieved map data for ${slug}`, {
        correlationId,
        slug,
        recordCount: mapData.data.length,
      });

      // Cache the map data
      await this.cache.set(`map:${slug}`, mapData);

      // Process and store the data
      await this.processMapData(mapData);
      
      logger.info(`Successfully ingested map activity for ${slug}`, {
        correlationId,
        slug,
        recordCount: mapData.data.length,
      });
    } catch (error) {
      throw errorHandler.handleExternalServiceError(
        error,
        'MAP_API',
        `ingestMapActivity/${slug}`
      );
    }
  }

  public async syncRecentMapActivity(slug: string): Promise<void> {
    try {
      const cachedData = await this.cache.get<{ data: any[] }>(`map:${slug}`);
      if (!cachedData) {
        logger.warn(`No cached map data for ${slug}`);
        return;
      }

      await this.processMapData(cachedData);
    } catch (error: any) {
      logger.error(`Error syncing recent map activity for ${slug}: ${error.message}`);
      throw error;
    }
  }

  public async refreshMapActivityData(slug: string, days = 7): Promise<void> {
    try {
      // Clear cache
      await this.cache.delete(`map:${slug}`);

      // Re-ingest data
      await this.ingestMapActivity(slug, days);
    } catch (error: any) {
      logger.error(`Error refreshing map activity data for ${slug}: ${error.message}`);
      throw error;
    }
  }

  private async processMapData(mapData: any): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      logger.debug('Processing map data', {
        correlationId,
        hasData: !!mapData,
      });

      // Validate the data structure
      const validatedData = MapActivityResponseSchema.parse(mapData);

      if (!validatedData.data || !Array.isArray(validatedData.data)) {
        logger.warn('Invalid map data format', {
          correlationId,
          hasValidatedData: !!validatedData,
          dataType: typeof validatedData.data,
        });
        return;
      }

      logger.debug(`Processing ${validatedData.data.length} map activity records`, {
        correlationId,
        recordCount: validatedData.data.length,
      });

      // Process each activity record
      let processedCount = 0;
      let errorCount = 0;
      
      for (const activity of validatedData.data) {
        try {
          const mapActivity = new MapActivity({
            characterId: BigInt(activity.character.eve_id),
            timestamp: new Date(activity.timestamp),
            signatures: activity.signatures || 0,
            connections: activity.connections || 0,
            passages: activity.passages || 0,
            allianceId: activity.character.alliance_id ?? null,
            corporationId: activity.character.corporation_id ?? null,
          });

          await errorHandler.withRetry(
            async () => {
              await this.upsertMapActivity(
                mapActivity.characterId,
                mapActivity.timestamp,
                mapActivity.signatures,
                mapActivity.connections,
                mapActivity.passages,
                mapActivity.allianceId,
                mapActivity.corporationId
              );
            },
            3,
            1000,
            {
              correlationId,
              operation: 'mapActivity.upsertMapActivity',
              metadata: { 
                characterId: mapActivity.characterId.toString(),
                timestamp: mapActivity.timestamp.toISOString(),
              },
            }
          );
          
          processedCount++;
        } catch (error) {
          errorCount++;
          logger.warn(`Failed to process map activity record`, {
            correlationId,
            characterId: activity.character?.eve_id,
            timestamp: activity.timestamp,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info(`Processed ${processedCount} map activity records (${errorCount} errors)`, {
        correlationId,
        processedCount,
        errorCount,
        totalRecords: validatedData.data.length,
      });
    } catch (error) {
      throw errorHandler.handleError(
        error,
        {
          correlationId,
          operation: 'processMapData',
          metadata: { 
            hasMapData: !!mapData,
            recordCount: mapData?.data?.length,
          },
        }
      );
    }
  }

  public async close(): Promise<void> {
    await this.cache.close();
  }

  async upsertMapActivity(
    characterId: bigint,
    timestamp: Date,
    signatures: number,
    connections: number,
    passages: number,
    allianceId: number | null,
    corporationId: number | null
  ): Promise<void> {
    await this.mapActivityRepository.upsertMapActivity(
      characterId,
      timestamp,
      signatures,
      connections,
      passages,
      allianceId,
      corporationId
    );
  }
}
