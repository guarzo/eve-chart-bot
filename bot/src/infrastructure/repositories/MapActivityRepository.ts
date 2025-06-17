import { MapActivity } from '../../domain/activity/MapActivity';
import { BaseRepository } from './BaseRepository';
import { logger } from '../../lib/logger';
import { errorHandler } from '../../shared/errors/ErrorHandler';

/**
 * Repository for map activity data access
 */
export class MapActivityRepository extends BaseRepository {
  constructor() {
    super('MapActivity');
  }

  /**
   * Get map activity for a character within a date range
   */
  async getActivityForCharacter(characterId: string, startDate: Date, endDate: Date): Promise<MapActivity[]> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Fetching map activity for character', {
          correlationId,
          characterId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const activities = await this.prisma.mapActivity.findMany({
          where: {
            characterId: BigInt(characterId),
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: {
            timestamp: 'desc',
          },
        });

        // Map activities with proper field name conversion from snake_case to camelCase
        const mapActivities = activities.map((activity: any) => {
          return new MapActivity({
            characterId: activity.characterId || activity.character_id,
            timestamp: activity.timestamp,
            signatures: activity.signatures,
            connections: activity.connections,
            passages: activity.passages,
            allianceId: activity.allianceId || activity.alliance_id,
            corporationId: activity.corporationId || activity.corporation_id,
          });
        });

        logger.debug('Successfully fetched map activity for character', {
          correlationId,
          characterId,
          activityCount: mapActivities.length,
        });

        return mapActivities;
      },
      'getActivityForCharacter',
      correlationId
    );
  }

  /**
   * Get map activity for multiple characters within a date range
   */
  async getActivityForCharacters(characterIds: string[], startDate: Date, endDate: Date): Promise<MapActivity[]> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Fetching map activity for characters', {
          correlationId,
          characterCount: characterIds.length,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        // Filter out invalid character IDs and convert valid ones to BigInt
        const validCharacterIds = characterIds
          .filter(id => id && id !== '' && id !== 'undefined' && id !== 'null')
          .map(id => {
            try {
              return BigInt(id);
            } catch (error) {
              logger.warn('Invalid character ID for BigInt conversion', {
                correlationId,
                characterId: id,
                error: error instanceof Error ? error.message : String(error),
              });
              return null;
            }
          })
          .filter((id): id is bigint => id !== null);

        if (validCharacterIds.length === 0) {
          logger.warn('No valid character IDs provided to getActivityForCharacters', {
            correlationId,
            originalCount: characterIds.length,
          });
          return [];
        }

        logger.debug('Querying map activity for valid character IDs', {
          correlationId,
          validCharacterCount: validCharacterIds.length,
          validCharacterIds: validCharacterIds.map(id => id.toString()),
        });

        const activities = await this.prisma.mapActivity.findMany({
          where: {
            characterId: {
              in: validCharacterIds,
            },
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: {
            timestamp: 'desc',
          },
        });

        logger.debug('Raw activities from database', {
          correlationId,
          activityCount: activities.length,
          sampleActivities: activities.slice(0, 2),
        });

        try {
          // Map activities with proper field name conversion from snake_case to camelCase
          const mapActivities = activities.map((activity: any) => {
            return new MapActivity({
              characterId: activity.characterId || activity.character_id,
              timestamp: activity.timestamp,
              signatures: activity.signatures,
              connections: activity.connections,
              passages: activity.passages,
              allianceId: activity.allianceId || activity.alliance_id,
              corporationId: activity.corporationId || activity.corporation_id,
            });
          });

          logger.debug('Successfully fetched and mapped activities for characters', {
            correlationId,
            mappedActivityCount: mapActivities.length,
          });

          return mapActivities;
        } catch (error) {
          logger.error('Error mapping activities to MapActivity domain objects', {
            correlationId,
            error: error instanceof Error ? error.message : String(error),
            sampleRawActivityData: activities.slice(0, 1),
          });
          throw error;
        }
      },
      'getActivityForCharacters',
      correlationId
    );
  }

  /**
   * Get map activity for a character group within a date range
   */
  async getActivityForGroup(groupId: string, startDate: Date, endDate: Date): Promise<MapActivity[]> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Fetching map activity for group', {
          correlationId,
          groupId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        // First, get all characters in the group
        const group = await this.prisma.characterGroup.findUnique({
          where: { id: groupId },
          include: { characters: true },
        });

        if (!group) {
          logger.debug('Group not found', {
            correlationId,
            groupId,
          });
          return [];
        }

        // Get character IDs and convert to strings
        const characterIds = group.characters.map(c => c.eveId.toString());

        logger.debug('Found characters in group', {
          correlationId,
          groupId,
          characterCount: characterIds.length,
          characterIds,
        });

        // Get activity for all characters
        const activities = await this.getActivityForCharacters(characterIds, startDate, endDate);

        logger.debug('Successfully fetched map activity for group', {
          correlationId,
          groupId,
          activityCount: activities.length,
        });

        return activities;
      },
      'getActivityForGroup',
      correlationId
    );
  }

  /**
   * Get map activity statistics for a character
   */
  async getActivityStats(
    characterId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSystems: number;
    totalSignatures: number;
    averageSignaturesPerSystem: number;
  }> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Calculating activity stats for character', {
          correlationId,
          characterId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const activities = await this.getActivityForCharacter(characterId, startDate, endDate);

        if (activities.length === 0) {
          logger.debug('No activities found for character stats', {
            correlationId,
            characterId,
          });
          return {
            totalSystems: 0,
            totalSignatures: 0,
            averageSignaturesPerSystem: 0,
          };
        }

        // Count unique activities as a proxy for systems since systemId doesn't exist
        const uniqueSystems = activities.length;

        // Sum total signatures
        const totalSignatures = activities.reduce((sum, a) => sum + a.signatures, 0);

        // Calculate average
        const averageSignaturesPerSystem = uniqueSystems > 0 ? totalSignatures / uniqueSystems : 0;

        const stats = {
          totalSystems: uniqueSystems,
          totalSignatures,
          averageSignaturesPerSystem,
        };

        logger.debug('Successfully calculated activity stats for character', {
          correlationId,
          characterId,
          stats,
        });

        return stats;
      },
      'getActivityStats',
      correlationId
    );
  }

  /**
   * Get map activity statistics for a character group
   */
  async getGroupActivityStats(
    groupId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSystems: number;
    totalSignatures: number;
    averageSignaturesPerSystem: number;
  }> {
    const correlationId = errorHandler.createCorrelationId();

    logger.info('Getting map activity stats for group', {
      correlationId,
      groupId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    return this.executeQuery(
      async () => {
        // First, get all characters in the group
        const group = await this.prisma.characterGroup.findUnique({
          where: { id: groupId },
          include: { characters: true },
        });

        if (!group) {
          logger.warn('Group not found for activity stats', {
            correlationId,
            groupId,
          });
          return {
            totalSystems: 0,
            totalSignatures: 0,
            averageSignaturesPerSystem: 0,
          };
        }

        // Get character IDs
        const characterIds = group.characters.map(c => c.eveId);
        logger.info('Found characters in group for activity stats', {
          correlationId,
          groupId,
          characterCount: characterIds.length,
          characterIds: characterIds.map(id => id.toString()),
        });

        if (characterIds.length === 0) {
          logger.warn('Group has no characters for activity stats', {
            correlationId,
            groupId,
          });
          return {
            totalSystems: 0,
            totalSignatures: 0,
            averageSignaturesPerSystem: 0,
          };
        }

        const activities = await this.getActivityForGroup(groupId, startDate, endDate);

        if (activities.length === 0) {
          logger.warn('No map activities found for group', {
            correlationId,
            groupId,
          });
          return {
            totalSystems: 0,
            totalSignatures: 0,
            averageSignaturesPerSystem: 0,
          };
        }

        logger.info('Found map activities for group', {
          correlationId,
          groupId,
          activityCount: activities.length,
        });

        // Count unique activities as a proxy for systems since systemId doesn't exist
        const uniqueSystems = activities.length;

        // Sum total signatures
        const totalSignatures = activities.reduce((sum, a) => sum + a.signatures, 0);

        // Calculate average
        const averageSignaturesPerSystem = uniqueSystems > 0 ? totalSignatures / uniqueSystems : 0;

        const stats = {
          totalSystems: uniqueSystems,
          totalSignatures,
          averageSignaturesPerSystem,
        };

        logger.info('Successfully calculated group activity stats', {
          correlationId,
          groupId,
          stats,
        });

        return stats;
      },
      'getGroupActivityStats',
      correlationId
    );
  }

  /**
   * Get map activity grouped by time period for chart data
   */
  async getActivityGroupedByTime(
    characterIds: string[],
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'day' | 'week' = 'day'
  ): Promise<Array<{ timestamp: Date; signatures: number; systems: number }>> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Fetching activity grouped by time', {
          correlationId,
          characterCount: characterIds.length,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          groupBy,
        });

        // Get all activity for the characters
        const activities = await this.getActivityForCharacters(characterIds, startDate, endDate);

        // Group by time period
        const timeMap = new Map<
          string,
          {
            timestamp: Date;
            signatures: number;
            systems: Set<string>; // Use a string combination of characterId+timestamp as unique identifier
          }
        >();

        // Format string for grouping
        const getTimeKey = (date: Date): string => {
          switch (groupBy) {
            case 'hour':
              return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
            case 'week': {
              const d = new Date(date);
              d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
              return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            }
            case 'day':
            default:
              return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          }
        };

        // Group the activities
        for (const activity of activities) {
          const timeKey = getTimeKey(activity.timestamp);

          if (!timeMap.has(timeKey)) {
            timeMap.set(timeKey, {
              timestamp: new Date(activity.timestamp),
              signatures: 0,
              systems: new Set<string>(),
            });
          }

          const group = timeMap.get(timeKey);
          if (!group) continue;
          group.signatures += activity.signatures;
          // Use a composite key since systemId doesn't exist
          group.systems.add(`${activity.characterId}-${activity.timestamp.toISOString()}`);
        }

        // Convert to array and sort by timestamp
        const groupedActivities = Array.from(timeMap.entries())
          .map(([, group]) => ({
            timestamp: group.timestamp,
            signatures: group.signatures,
            systems: group.systems.size,
          }))
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        logger.debug('Successfully grouped activities by time', {
          correlationId,
          originalActivityCount: activities.length,
          groupedCount: groupedActivities.length,
          totalSignatures: groupedActivities.reduce((sum, g) => sum + g.signatures, 0),
        });

        return groupedActivities;
      },
      'getActivityGroupedByTime',
      correlationId
    );
  }

  /**
   * Create or update a map activity record
   */
  async upsertMapActivity(
    characterId: bigint,
    timestamp: Date,
    signatures: number,
    connections: number,
    passages: number,
    allianceId: number | null,
    corporationId: number | null
  ): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Upserting map activity', {
          correlationId,
          characterId: characterId.toString(),
          timestamp: timestamp.toISOString(),
          signatures,
          connections,
          passages,
          allianceId,
          corporationId,
        });

        await this.prisma.mapActivity.upsert({
          where: {
            characterId_timestamp: {
              characterId,
              timestamp,
            },
          },
          update: {
            signatures,
            connections,
            passages,
            allianceId: allianceId ?? undefined,
            corporationId: corporationId ?? 0,
          },
          create: {
            characterId,
            timestamp,
            signatures,
            connections,
            passages,
            allianceId: allianceId ?? undefined,
            corporationId: corporationId ?? 0,
          },
        });

        logger.debug('Successfully upserted map activity', {
          correlationId,
          characterId: characterId.toString(),
          timestamp: timestamp.toISOString(),
        });
      },
      'upsertMapActivity',
      correlationId
    );
  }

  /**
   * Delete all map activity records
   */
  async deleteAllMapActivity(): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Deleting all map activity records', { correlationId });

        const result = await this.prisma.mapActivity.deleteMany();

        logger.debug('Successfully deleted all map activity records', {
          correlationId,
          deletedCount: result.count,
        });
      },
      'deleteAllMapActivity',
      correlationId
    );
  }

  /**
   * Count total map activity records
   */
  override async count(): Promise<number> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Counting total map activity records', { correlationId });

        const count = await this.prisma.mapActivity.count();

        logger.debug('Successfully counted map activity records', {
          correlationId,
          count,
        });

        return count;
      },
      'count',
      correlationId
    );
  }
}
