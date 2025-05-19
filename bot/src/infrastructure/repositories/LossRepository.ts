import { BaseRepository } from "./BaseRepository";
import { logger } from "../../lib/logger";
import { LossFact } from "@prisma/client";
import { CharacterSummary } from "../../types/discord";
import { SimpleTimeRange } from "../../types/chart";
import { buildWhereFilter } from "../../utils/query-helper";

/**
 * Repository for accessing ship loss data
 * This is a placeholder implementation that will be fully implemented in Phase 4
 */
export class LossRepository extends BaseRepository {
  constructor() {
    super("lossFact");
  }

  /**
   * Get total losses for a character in a time period
   * @param characterId Character EVE ID
   * @param startDate Start date for query range
   * @param endDate End date for query range
   */
  async getLossesByCharacter(
    characterId: bigint,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    return this.executeQuery(async () => {
      logger.debug(
        `Fetching losses for character ${characterId} from ${startDate} to ${endDate}`
      );

      const where = buildWhereFilter({
        character_id: characterId,
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      });

      const result = await this.prisma.lossFact.count({ where });

      return result;
    });
  }

  /**
   * Get high value losses for a character in a time period
   * @param characterId Character EVE ID
   * @param startDate Start date for query range
   * @param endDate End date for query range
   * @param valueThreshold Minimum ISK value to be considered high value
   */
  async getHighValueLossesByCharacter(
    characterId: bigint,
    startDate: Date,
    endDate: Date,
    valueThreshold: bigint = BigInt(100000000) // 100M ISK default threshold
  ): Promise<number> {
    return this.executeQuery(async () => {
      logger.debug(
        `Fetching high value losses for character ${characterId} from ${startDate} to ${endDate}`
      );

      const where = buildWhereFilter({
        character_id: characterId,
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
        total_value: {
          gte: valueThreshold,
        },
      });

      const result = await this.prisma.lossFact.count({ where });

      return result;
    });
  }

  /**
   * Get total value lost for a character in a time period
   * @param characterId Character EVE ID
   * @param startDate Start date for query range
   * @param endDate End date for query range
   */
  async getTotalValueLostByCharacter(
    characterId: bigint,
    startDate: Date,
    endDate: Date
  ): Promise<bigint> {
    return this.executeQuery(async () => {
      logger.debug(
        `Fetching total value lost for character ${characterId} from ${startDate} to ${endDate}`
      );

      const where = buildWhereFilter({
        character_id: characterId,
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      });

      const results = await this.prisma.lossFact.findMany({
        where,
        select: {
          total_value: true,
        },
      });

      // Sum up the total values
      return results.reduce(
        (sum, result) => sum + result.total_value,
        BigInt(0)
      );
    });
  }

  /**
   * Get losses summary for a group of characters
   * @param characterIds Array of character EVE IDs
   * @param startDate Start date for query range
   * @param endDate End date for query range
   */
  async getLossesSummaryByCharacters(
    characterIds: bigint[],
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalLosses: number;
    highValueLosses: number;
    totalValueLost: bigint;
  }> {
    return this.executeQuery(async () => {
      logger.debug(
        `Fetching losses summary for ${characterIds.length} characters from ${startDate} to ${endDate}`
      );

      // Get all losses for these characters
      const where = buildWhereFilter({
        character_id: {
          in: characterIds,
        },
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      });

      const losses = await this.prisma.lossFact.findMany({ where });

      // Calculate summary
      const totalLosses = losses.length;
      const highValueLosses = losses.filter(
        (loss) => loss.total_value >= BigInt(100000000)
      ).length;
      const totalValueLost = losses.reduce(
        (sum, loss) => sum + loss.total_value,
        BigInt(0)
      );

      return {
        totalLosses,
        highValueLosses,
        totalValueLost,
      };
    });
  }

  async countByTimeRange(
    characterIds: string[],
    timeRange: SimpleTimeRange
  ): Promise<number> {
    return this.executeQuery(async () => {
      // Convert string character IDs to BigInt for comparison
      const bigIntCharacterIds = characterIds.map((id) => BigInt(id));

      const where = buildWhereFilter({
        character_id: {
          in: bigIntCharacterIds,
        },
        kill_time: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      });

      const result = await this.prisma.lossFact.count({ where });

      return result;
    });
  }

  async countByShipType(
    characterIds: string[],
    timeRange: SimpleTimeRange
  ): Promise<Record<number, number>> {
    return this.executeQuery(async () => {
      // Convert string character IDs to BigInt for comparison
      const bigIntCharacterIds = characterIds.map((id) => BigInt(id));

      const where = buildWhereFilter({
        character_id: {
          in: bigIntCharacterIds,
        },
        kill_time: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      });

      const result = await this.prisma.lossFact.groupBy({
        by: ["ship_type_id"],
        where,
        _count: true,
      });

      // Convert result to Record<number, number> as expected
      const shipTypeCounts: Record<number, number> = {};
      for (const item of result) {
        if (item.ship_type_id !== null) {
          shipTypeCounts[item.ship_type_id] = item._count;
        }
      }

      return shipTypeCounts;
    });
  }

  async getLossesByTimeRange(
    characterIds: string[],
    timeRange: SimpleTimeRange
  ): Promise<LossFact[]> {
    return this.executeQuery(async () => {
      // Convert string character IDs to BigInt for comparison
      const bigIntCharacterIds = characterIds.map((id) => BigInt(id));

      const where = buildWhereFilter({
        character_id: {
          in: bigIntCharacterIds,
        },
        kill_time: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      });

      const results = await this.prisma.lossFact.findMany({
        where,
        orderBy: {
          kill_time: "desc",
        },
      });

      return results;
    });
  }

  async getLossesByTimeRangeGrouped(
    characters: CharacterSummary[],
    timeRange: SimpleTimeRange,
    timeGrouping: "day" | "week" | "month"
  ): Promise<{ time: Date; losses: number }[]> {
    return this.executeQuery(async () => {
      // Convert character IDs to BigInt for comparison
      const characterIds = characters.map((c) => BigInt(c.eveId));

      const where = buildWhereFilter({
        character_id: {
          in: characterIds,
        },
        kill_time: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      });

      const losses = await this.prisma.lossFact.findMany({
        where,
        select: {
          kill_time: true,
        },
        orderBy: {
          kill_time: "asc",
        },
      });

      // Group by time period
      const groupedLosses = new Map<string, number>();

      for (const loss of losses) {
        const time = loss.kill_time;
        if (!time) continue;

        let timeKey: string;

        if (timeGrouping === "day") {
          timeKey = time.toISOString().substring(0, 10); // YYYY-MM-DD
        } else if (timeGrouping === "week") {
          // Get the week start (Sunday)
          const weekStart = new Date(time);
          const day = weekStart.getDay();
          weekStart.setDate(weekStart.getDate() - day);
          timeKey = weekStart.toISOString().substring(0, 10);
        } else if (timeGrouping === "month") {
          timeKey = time.toISOString().substring(0, 7); // YYYY-MM
        } else {
          timeKey = time.toISOString().substring(0, 10); // Default to day
        }

        groupedLosses.set(timeKey, (groupedLosses.get(timeKey) || 0) + 1);
      }

      // Convert to array for chart data
      const result: { time: Date; losses: number }[] = [];

      for (const [timeKey, count] of groupedLosses.entries()) {
        let time: Date;
        if (timeGrouping === "month") {
          time = new Date(`${timeKey}-01T00:00:00Z`);
        } else {
          time = new Date(`${timeKey}T00:00:00Z`);
        }
        result.push({ time, losses: count });
      }

      // Sort by timestamp
      return result.sort((a, b) => a.time.getTime() - b.time.getTime());
    });
  }

  /**
   * Get the top ship types lost within a date range
   */
  async getTopShipTypesLost(
    characterIds: string[],
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{ shipTypeId: string; count: number }>> {
    return this.executeQuery(async () => {
      // Convert strings to BigInts for query
      const bigIntIds = characterIds.map((id) => BigInt(id));

      const where = buildWhereFilter({
        character_id: {
          in: bigIntIds,
        },
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      });

      // Get all losses for the characters in the specified date range
      const losses = await this.prisma.lossFact.findMany({
        where,
        select: {
          killmail_id: true,
          ship_type_id: true,
        },
      });

      // Group losses by ship type
      const shipTypeCounts = new Map<string, { id: string; count: number }>();

      for (const loss of losses) {
        const shipTypeId = loss.ship_type_id.toString();
        if (shipTypeCounts.has(shipTypeId)) {
          shipTypeCounts.get(shipTypeId)!.count++;
        } else {
          shipTypeCounts.set(shipTypeId, {
            id: shipTypeId,
            count: 1,
          });
        }
      }

      // Convert to array and sort by count
      const result = Array.from(shipTypeCounts.values())
        .map((item) => ({
          shipTypeId: item.id,
          count: item.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return result;
    });
  }
}
