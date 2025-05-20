import { BaseRepository } from "./BaseRepository";
import { logger } from "../../lib/logger";
import { LossFact } from "../../domain/killmail/LossFact";
import { PrismaMapper } from "../mapper/PrismaMapper";
import { buildWhereFilter } from "../../utils/query-helper";

/**
 * Repository for accessing ship loss data
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
      const lossFacts = PrismaMapper.mapArray(losses, LossFact);

      // Calculate summary
      const totalLosses = lossFacts.length;
      const highValueLosses = lossFacts.filter(
        (loss) => loss.totalValue >= BigInt(100000000)
      ).length;
      const totalValueLost = lossFacts.reduce(
        (sum, loss) => sum + loss.totalValue,
        BigInt(0)
      );

      return {
        totalLosses,
        highValueLosses,
        totalValueLost,
      };
    });
  }

  /**
   * Get a loss by killmail ID
   * @param killmailId Killmail ID to look up
   */
  async getLoss(killmailId: bigint): Promise<LossFact | null> {
    return this.executeQuery(async () => {
      const loss = await this.prisma.lossFact.findUnique({
        where: { killmail_id: killmailId },
      });

      if (!loss) {
        return null;
      }

      return PrismaMapper.map(loss, LossFact);
    });
  }

  /**
   * Get all losses for a character
   * @param characterId Character EVE ID
   * @param startDate Start date for query range
   * @param endDate End date for query range
   */
  async getLossesForCharacter(
    characterId: bigint,
    startDate: Date,
    endDate: Date
  ): Promise<LossFact[]> {
    return this.executeQuery(async () => {
      const losses = await this.prisma.lossFact.findMany({
        where: {
          character_id: characterId,
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          kill_time: "desc",
        },
      });

      return PrismaMapper.mapArray(losses, LossFact);
    });
  }

  /**
   * Save a loss record
   * @param loss LossFact domain entity to save
   */
  async saveLoss(loss: LossFact): Promise<void> {
    return this.executeQuery(async () => {
      const data = loss.toObject();
      await this.prisma.lossFact.upsert({
        where: { killmail_id: loss.killmailId },
        update: {
          kill_time: data.killTime,
          system_id: data.systemId,
          total_value: data.totalValue,
          attacker_count: data.attackerCount,
          labels: data.labels,
          character_id: data.characterId,
          ship_type_id: data.shipTypeId,
        },
        create: {
          killmail_id: data.killmailId,
          kill_time: data.killTime,
          system_id: data.systemId,
          total_value: data.totalValue,
          attacker_count: data.attackerCount,
          labels: data.labels,
          character_id: data.characterId,
          ship_type_id: data.shipTypeId,
        },
      });
    });
  }

  /**
   * Delete all loss records
   */
  async deleteAllLosses(): Promise<void> {
    await this.executeQuery(async () => {
      await this.prisma.lossFact.deleteMany();
    });
  }

  /**
   * Get losses within a time range
   * @param startDate Start date for query range
   * @param endDate End date for query range
   */
  async getLossesByTimeRange(
    startDate: Date,
    endDate: Date
  ): Promise<LossFact[]> {
    return this.executeQuery(async () => {
      const losses = await this.prisma.lossFact.findMany({
        where: {
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          kill_time: "desc",
        },
      });

      return PrismaMapper.mapArray(losses, LossFact);
    });
  }

  /**
   * Count total loss records
   */
  async count(): Promise<number> {
    return this.executeQuery(async () => {
      return this.prisma.lossFact.count();
    });
  }

  /**
   * Get the top ship types lost within a date range
   */
  async getTopShipTypesLost(
    characterIds: (string | bigint)[],
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{ shipTypeId: string; count: number }>> {
    return this.executeQuery(async () => {
      // Find all losses for these characters in the date range
      const losses = await this.prisma.lossFact.findMany({
        where: {
          character_id: {
            in: characterIds.map((id) => BigInt(id)),
          },
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          ship_type_id: true,
        },
      });
      // Count occurrences of each ship type
      const shipTypeCounts = new Map<string, number>();
      for (const loss of losses) {
        const shipTypeId = loss.ship_type_id.toString();
        shipTypeCounts.set(
          shipTypeId,
          (shipTypeCounts.get(shipTypeId) || 0) + 1
        );
      }
      return Array.from(shipTypeCounts.entries())
        .map(([shipTypeId, count]) => ({ shipTypeId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    });
  }
}
