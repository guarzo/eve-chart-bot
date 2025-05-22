import { MapClient } from "../../infrastructure/http/MapClient";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";
import { MapActivityRepository } from "../../infrastructure/repositories/MapActivityRepository";
import { MapActivity } from "../../domain/activity/MapActivity";
import { logger } from "../../lib/logger";
import { retryOperation } from "../../utils/retry";

/**
 * Service for ingesting map activity data from the Map API
 */
export class MapActivityIngestionService {
  private readonly map: MapClient;
  private readonly characterRepository: CharacterRepository;
  private readonly mapActivityRepository: MapActivityRepository;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    mapApiUrl: string,
    mapApiKey: string,
    maxRetries: number = 3,
    retryDelay: number = 5000
  ) {
    this.map = new MapClient(mapApiUrl, mapApiKey);
    this.characterRepository = new CharacterRepository();
    this.mapActivityRepository = new MapActivityRepository();
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Ingest map activity for a character
   * @param characterId Character ID to ingest activity for
   * @param days Number of days of activity to ingest
   */
  public async ingestMapActivity(
    characterId: bigint,
    days: number = 7
  ): Promise<{
    success: boolean;
    skipped?: boolean;
    existing?: boolean;
    timestamp?: string;
    age?: number;
    error?: string;
  }> {
    try {
      // Get character info
      const character = await this.characterRepository.getCharacter(
        characterId.toString()
      );
      if (!character) {
        throw new Error(`Character ${characterId} not found`);
      }

      // Check if we've processed this character recently (within last hour)
      const lastBackfillAt = character.lastBackfillAt;
      if (lastBackfillAt) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (lastBackfillAt > oneHourAgo) {
          logger.info(
            `Skipping character ${characterId} - last processed at ${lastBackfillAt.toISOString()}`
          );
          return {
            success: false,
            skipped: true,
            skipReason: "rate limited",
            timestamp: lastBackfillAt.toISOString(),
            age: Math.floor((Date.now() - lastBackfillAt.getTime()) / 1000),
          };
        }
      }

      // Get map name from environment
      const mapName = process.env.MAP_NAME;
      if (!mapName) {
        throw new Error("MAP_NAME environment variable not set");
      }

      // Fetch from Map API with retry
      const mapData = await retryOperation(
        () => this.map.getCharacterActivity(mapName, days),
        `Fetching map data for character ${characterId}`,
        {
          maxRetries: this.maxRetries,
          initialRetryDelay: this.retryDelay,
          timeout: 30000,
        }
      );

      if (!mapData || !mapData.data || !Array.isArray(mapData.data)) {
        logger.warn(`No valid map data available for character ${characterId}`);
        return { success: false, skipped: true };
      }

      // Process each activity record
      let successfulIngestCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const activity of mapData.data) {
        try {
          // Skip if not for this character
          if (activity.characterId !== characterId.toString()) {
            continue;
          }

          // Create map activity record
          const mapActivity = new MapActivity({
            characterId: BigInt(activity.characterId),
            timestamp: new Date(activity.timestamp),
            signatures: activity.signatures || 0,
            connections: activity.connections || 0,
            passages: activity.passages || 0,
            allianceId: activity.allianceId || null,
            corporationId: activity.corporationId,
          });

          // Save to database
          await this.mapActivityRepository.saveMapActivity(mapActivity);
          successfulIngestCount++;
        } catch (error: any) {
          logger.error(
            `Error processing map activity for character ${characterId}:`,
            error
          );
          errorCount++;
        }
      }

      // Update last backfill time
      await this.characterRepository.updateLastBackfillAt(
        characterId.toString()
      );

      logger.info(
        `Processed map activity for character ${characterId}: ${successfulIngestCount} ingested, ${skippedCount} skipped, ${errorCount} errors`
      );

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error(
        `Error ingesting map activity for character ${characterId}:`,
        error
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Backfill map activity for a character
   * @param characterId Character ID to backfill activity for
   * @param maxAgeDays Maximum age of activity to backfill in days
   */
  public async backfillMapActivity(
    characterId: bigint,
    maxAgeDays: number = 30
  ): Promise<void> {
    try {
      logger.info(
        `Backfilling map activity for character ${characterId} (max age: ${maxAgeDays} days)`
      );

      // Get character info
      const character = await this.characterRepository.getCharacter(
        characterId.toString()
      );
      if (!character) {
        throw new Error(`Character ${characterId} not found`);
      }

      // Get map name from environment
      const mapName = process.env.MAP_NAME;
      if (!mapName) {
        throw new Error("MAP_NAME environment variable not set");
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - maxAgeDays);

      // Fetch from Map API with retry
      const mapData = await retryOperation(
        () => this.map.getCharacterActivity(mapName, maxAgeDays),
        `Fetching map data for character ${characterId}`,
        {
          maxRetries: this.maxRetries,
          initialRetryDelay: this.retryDelay,
          timeout: 30000,
        }
      );

      if (!mapData || !mapData.data || !Array.isArray(mapData.data)) {
        logger.warn(`No valid map data available for character ${characterId}`);
        return;
      }

      // Filter activities by date range and character
      const filteredActivities = mapData.data.filter(
        (activity: {
          timestamp: string | number | Date;
          characterId: string;
        }) => {
          const activityTime = new Date(activity.timestamp);
          return (
            activityTime >= startDate &&
            activityTime <= endDate &&
            activity.characterId === characterId.toString()
          );
        }
      );

      logger.info(
        `Found ${filteredActivities.length} map activities to process for character ${characterId}`
      );

      // Process each activity record
      let successfulIngestCount = 0;
      let skippedCount = 0;

      for (const activity of filteredActivities) {
        try {
          // Create and save map activity
          const mapActivity = new MapActivity({
            characterId: BigInt(activity.characterId),
            timestamp: new Date(activity.timestamp),
            signatures: activity.signatures || 0,
            connections: activity.connections || 0,
            passages: activity.passages || 0,
            allianceId: activity.allianceId || null,
            corporationId: activity.corporationId,
          });

          await this.mapActivityRepository.upsertMapActivity(
            mapActivity.characterId.toString(),
            mapActivity.timestamp,
            mapActivity.signatures,
            mapActivity.connections,
            mapActivity.passages,
            mapActivity.allianceId,
            mapActivity.corporationId
          );

          successfulIngestCount++;
        } catch (error) {
          logger.error(
            `Error processing map activity for character ${characterId}:`,
            error
          );
          skippedCount++;
        }
      }

      logger.info(
        `Map activity backfill complete for character ${characterId}: Processed ${successfulIngestCount}, Skipped ${skippedCount}`
      );
    } catch (error: any) {
      logger.error(
        `Error backfilling map activity for character ${characterId}: ${error.message}`
      );
      throw error;
    }
  }
}
