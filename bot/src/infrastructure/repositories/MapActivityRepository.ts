import { BaseRepository } from "./BaseRepository";
import { MapActivity } from "../../domain/activity/MapActivity";
import { PrismaMapper } from "../mapper/PrismaMapper";
import { logger } from "../../lib/logger";

/**
 * Repository for map activity data access
 */
export class MapActivityRepository extends BaseRepository {
  constructor() {
    super("MapActivity");
  }

  /**
   * Get map activity for a character within a date range
   */
  async getActivityForCharacter(
    characterId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MapActivity[]> {
    return this.executeQuery(async () => {
      const activities = await this.prisma.mapActivity.findMany({
        where: {
          characterId: BigInt(characterId),
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          timestamp: "desc",
        },
      });
      return PrismaMapper.mapArray(activities, MapActivity);
    });
  }

  /**
   * Get map activity for multiple characters within a date range
   */
  async getActivityForCharacters(
    characterIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<MapActivity[]> {
    return this.executeQuery(async () => {
      // Filter out invalid character IDs and convert valid ones to BigInt
      const validCharacterIds = characterIds
        .filter((id) => id && id !== "" && id !== "undefined" && id !== "null")
        .map((id) => {
          try {
            return BigInt(id);
          } catch (error) {
            logger.warn(`Invalid character ID for BigInt conversion: ${id}`);
            return null;
          }
        })
        .filter((id): id is bigint => id !== null);

      if (validCharacterIds.length === 0) {
        logger.warn(
          "No valid character IDs provided to getActivityForCharacters"
        );
        return [];
      }

      logger.debug(
        `Querying map activity for ${validCharacterIds.length} valid character IDs`
      );

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
          timestamp: "desc",
        },
      });

      logger.debug(`Raw activities from database:`, activities.slice(0, 2)); // Log first 2 records

      try {
        return PrismaMapper.mapArray(activities, MapActivity);
      } catch (error) {
        logger.error(
          `Error mapping activities to MapActivity domain objects:`,
          error
        );
        logger.error(`Sample raw activity data:`, activities.slice(0, 1));
        throw error;
      }
    });
  }

  /**
   * Get map activity for a character group within a date range
   */
  async getActivityForGroup(
    groupId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MapActivity[]> {
    return this.executeQuery(async () => {
      // First, get all characters in the group
      const group = await this.prisma.characterGroup.findUnique({
        where: { id: groupId },
        include: { characters: true },
      });

      if (!group) {
        return [];
      }

      // Get character IDs and convert to strings
      const characterIds = group.characters.map((c) => c.eveId.toString());

      // Get activity for all characters
      return this.getActivityForCharacters(characterIds, startDate, endDate);
    });
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
    return this.executeQuery(async () => {
      const activities = await this.getActivityForCharacter(
        characterId,
        startDate,
        endDate
      );

      if (activities.length === 0) {
        return {
          totalSystems: 0,
          totalSignatures: 0,
          averageSignaturesPerSystem: 0,
        };
      }

      // Count unique activities as a proxy for systems since systemId doesn't exist
      const uniqueSystems = activities.length;

      // Sum total signatures
      const totalSignatures = activities.reduce(
        (sum, a) => sum + a.signatures,
        0
      );

      // Calculate average
      const averageSignaturesPerSystem =
        uniqueSystems > 0 ? totalSignatures / uniqueSystems : 0;

      return {
        totalSystems: uniqueSystems,
        totalSignatures,
        averageSignaturesPerSystem,
      };
    });
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
    logger.info(
      `Getting map activity stats for group ${groupId} from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    return this.executeQuery(async () => {
      // First, get all characters in the group
      const group = await this.prisma.characterGroup.findUnique({
        where: { id: groupId },
        include: { characters: true },
      });

      if (!group) {
        logger.warn(`Group ${groupId} not found`);
        return {
          totalSystems: 0,
          totalSignatures: 0,
          averageSignaturesPerSystem: 0,
        };
      }

      // Get character IDs
      const characterIds = group.characters.map((c) => c.eveId);
      logger.info(
        `Group ${groupId} has ${
          characterIds.length
        } characters: ${characterIds.join(", ")}`
      );

      if (characterIds.length === 0) {
        logger.warn(`Group ${groupId} has no characters`);
        return {
          totalSystems: 0,
          totalSignatures: 0,
          averageSignaturesPerSystem: 0,
        };
      }

      const activities = await this.getActivityForGroup(
        groupId,
        startDate,
        endDate
      );

      if (activities.length === 0) {
        logger.warn(`No map activities found for group ${groupId}`);
        return {
          totalSystems: 0,
          totalSignatures: 0,
          averageSignaturesPerSystem: 0,
        };
      }

      logger.info(
        `Found ${activities.length} map activities for group ${groupId}`
      );

      // Count unique activities as a proxy for systems since systemId doesn't exist
      const uniqueSystems = activities.length;

      // Sum total signatures
      const totalSignatures = activities.reduce(
        (sum, a) => sum + a.signatures,
        0
      );

      // Calculate average
      const averageSignaturesPerSystem =
        uniqueSystems > 0 ? totalSignatures / uniqueSystems : 0;

      return {
        totalSystems: uniqueSystems,
        totalSignatures,
        averageSignaturesPerSystem,
      };
    });
  }

  /**
   * Get map activity grouped by time period for chart data
   */
  async getActivityGroupedByTime(
    characterIds: string[],
    startDate: Date,
    endDate: Date,
    groupBy: "hour" | "day" | "week" = "day"
  ): Promise<Array<{ timestamp: Date; signatures: number; systems: number }>> {
    return this.executeQuery(async () => {
      // Get all activity for the characters
      const activities = await this.getActivityForCharacters(
        characterIds,
        startDate,
        endDate
      );

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
          case "hour":
            return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
          case "week":
            const d = new Date(date);
            d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          case "day":
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

        const group = timeMap.get(timeKey)!;
        group.signatures += activity.signatures;
        // Use a composite key since systemId doesn't exist
        group.systems.add(
          `${activity.characterId}-${activity.timestamp.toISOString()}`
        );
      }

      // Convert to array and sort by timestamp
      return Array.from(timeMap.entries())
        .map(([_, group]) => ({
          timestamp: group.timestamp,
          signatures: group.signatures,
          systems: group.systems.size,
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    });
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
  }

  /**
   * Delete all map activity records
   */
  async deleteAllMapActivity(): Promise<void> {
    await this.executeQuery(async () => {
      await this.prisma.mapActivity.deleteMany();
    });
  }

  /**
   * Count total map activity records
   */
  async count(): Promise<number> {
    return this.executeQuery(async () => {
      return this.prisma.mapActivity.count();
    });
  }
}
