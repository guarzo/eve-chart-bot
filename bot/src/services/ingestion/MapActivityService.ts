import { MapClient } from "../../infrastructure/http/MapClient";
import { CacheRedisAdapter } from "../../cache/CacheRedisAdapter";
import { retryOperation } from "../../utils/retry";
import { logger } from "../../lib/logger";
import { MapActivityResponseSchema } from "../../types/ingestion";
import { MapActivityRepository } from "../../infrastructure/repositories/MapActivityRepository";
import { MapActivity } from "../../domain/activity/MapActivity";

export class MapActivityService {
  private readonly map: MapClient;
  private readonly cache: CacheRedisAdapter;
  private readonly mapActivityRepository: MapActivityRepository;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    mapApiUrl: string,
    mapApiKey: string,
    redisUrl: string = "redis://localhost:6379",
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

  public async ingestMapActivity(slug: string, days = 7): Promise<void> {
    try {
      // Get map data with retry
      const mapData = await retryOperation(
        async () => {
          const result = await this.map.getCharacterActivity(slug, days);
          if (!result) {
            throw new Error("No data returned from Map API");
          }
          return result;
        },
        `Fetching map data for ${slug}`,
        {
          maxRetries: this.maxRetries,
          initialRetryDelay: this.retryDelay,
          timeout: 30000,
        }
      );

      if (!mapData || !mapData.data || !Array.isArray(mapData.data)) {
        logger.warn(`No valid map data available for ${slug}`);
        return;
      }

      // Cache the map data
      await this.cache.set(`map:${slug}`, mapData);

      // Process and store the data
      await this.processMapData(mapData);
    } catch (error: any) {
      logger.error(
        `Error ingesting map activity for ${slug}: ${error.message}`
      );
      throw error;
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
      logger.error(
        `Error syncing recent map activity for ${slug}: ${error.message}`
      );
      throw error;
    }
  }

  public async refreshMapActivityData(slug: string, days = 7): Promise<void> {
    try {
      // Clear cache
      await this.cache.del(`map:${slug}`);

      // Re-ingest data
      await this.ingestMapActivity(slug, days);
    } catch (error: any) {
      logger.error(
        `Error refreshing map activity data for ${slug}: ${error.message}`
      );
      throw error;
    }
  }

  private async processMapData(mapData: any): Promise<void> {
    try {
      // Validate the data structure
      const validatedData = MapActivityResponseSchema.parse(mapData);

      if (!validatedData.data || !Array.isArray(validatedData.data)) {
        logger.warn("Invalid map data format");
        return;
      }

      // Process each activity record
      for (const activity of validatedData.data) {
        const mapActivity = new MapActivity({
          characterId: BigInt(activity.character.eve_id),
          timestamp: new Date(activity.timestamp),
          signatures: activity.signatures || 0,
          connections: activity.connections || 0,
          passages: activity.passages || 0,
          allianceId: activity.character.alliance_id ?? null,
          corporationId: activity.character.corporation_id ?? null,
        });

        await this.upsertMapActivity(
          mapActivity.characterId.toString(),
          mapActivity.timestamp,
          mapActivity.signatures,
          mapActivity.connections,
          mapActivity.passages,
          mapActivity.allianceId,
          mapActivity.corporationId
        );
      }

      logger.info(
        `Processed ${validatedData.data.length} map activity records`
      );
    } catch (error: any) {
      logger.error(`Error processing map data: ${error.message}`);
      throw error;
    }
  }

  public async close(): Promise<void> {
    await this.cache.close();
  }

  async upsertMapActivity(
    characterId: string,
    timestamp: Date,
    signatures: number,
    connections: number,
    passages: number,
    allianceId: number | null,
    corporationId: number | null
  ): Promise<void> {
    if (corporationId === null) {
      throw new Error("corporationId is required");
    }

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
