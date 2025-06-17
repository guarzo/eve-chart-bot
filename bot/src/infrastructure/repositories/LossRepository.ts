import { BaseRepository } from './BaseRepository';
import { logger } from '../../lib/logger';
import { LossFact } from '../../domain/killmail/LossFact';
import { PrismaMapper } from '../mapper/PrismaMapper';
import { buildWhereFilter } from '../../shared/utilities/query-helper';
import { errorHandler } from '../../shared/errors';

/**
 * Repository for accessing ship loss data
 */
export class LossRepository extends BaseRepository {
  constructor() {
    super('lossFact');
  }

  /**
   * Get total losses for a character in a time period
   * @param characterId Character EVE ID
   * @param startDate Start date for query range
   * @param endDate End date for query range
   */
  async getLossesByCharacter(characterId: bigint, startDate: Date, endDate: Date): Promise<number> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Fetching losses for character', {
          correlationId,
          characterId: characterId.toString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const where = buildWhereFilter({
          characterId: characterId,
          killTime: {
            gte: startDate,
            lte: endDate,
          },
        });

        const result = await this.prisma.lossFact.count({ where });

        logger.debug('Successfully counted character losses', {
          correlationId,
          characterId: characterId.toString(),
          lossCount: result,
        });

        return result;
      },
      'getLossesByCharacter',
      correlationId
    );
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
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Fetching high value losses for character', {
          correlationId,
          characterId: characterId.toString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          valueThreshold: valueThreshold.toString(),
        });

        const where = buildWhereFilter({
          characterId: characterId,
          killTime: {
            gte: startDate,
            lte: endDate,
          },
          totalValue: {
            gte: valueThreshold,
          },
        });

        const result = await this.prisma.lossFact.count({ where });

        logger.debug('Successfully counted high value character losses', {
          correlationId,
          characterId: characterId.toString(),
          highValueLossCount: result,
        });

        return result;
      },
      'getHighValueLossesByCharacter',
      correlationId
    );
  }

  /**
   * Get total value lost for a character in a time period
   * @param characterId Character EVE ID
   * @param startDate Start date for query range
   * @param endDate End date for query range
   */
  async getTotalValueLostByCharacter(characterId: bigint, startDate: Date, endDate: Date): Promise<bigint> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Fetching total value lost for character', {
          correlationId,
          characterId: characterId.toString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const where = buildWhereFilter({
          characterId: characterId,
          killTime: {
            gte: startDate,
            lte: endDate,
          },
        });

        const results = await this.prisma.lossFact.findMany({
          where,
          select: {
            totalValue: true,
          },
        });

        // Sum up the total values
        const totalValue = results.reduce((sum, result) => sum + result.totalValue, BigInt(0));

        logger.debug('Successfully calculated total value lost for character', {
          correlationId,
          characterId: characterId.toString(),
          recordCount: results.length,
          totalValue: totalValue.toString(),
        });

        return totalValue;
      },
      'getTotalValueLostByCharacter',
      correlationId
    );
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
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Fetching losses summary for characters', {
          correlationId,
          characterCount: characterIds.length,
          characterIds: characterIds.map(id => id.toString()),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        // Get all losses for these characters
        const where = buildWhereFilter({
          characterId: {
            in: characterIds,
          },
          killTime: {
            gte: startDate,
            lte: endDate,
          },
        });

        const losses = await this.prisma.lossFact.findMany({ where });
        const lossFacts = PrismaMapper.mapArray(losses, LossFact);

        // Calculate summary
        const totalLosses = lossFacts.length;
        const highValueLosses = lossFacts.filter(loss => loss.totalValue >= BigInt(100000000)).length;
        const totalValueLost = lossFacts.reduce((sum, loss) => sum + loss.totalValue, BigInt(0));

        logger.debug('Successfully calculated losses summary for characters', {
          correlationId,
          totalLosses,
          highValueLosses,
          totalValueLost: totalValueLost.toString(),
        });

        return {
          totalLosses,
          highValueLosses,
          totalValueLost,
        };
      },
      'getLossesSummaryByCharacters',
      correlationId
    );
  }

  /**
   * Get a loss by killmail ID
   * @param killmailId Killmail ID to look up
   */
  async getLoss(killmailId: bigint): Promise<LossFact | null> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Fetching loss by killmail ID', {
          correlationId,
          killmailId: killmailId.toString(),
        });

        const loss = await this.prisma.lossFact.findUnique({
          where: { killmailId: killmailId },
        });

        if (!loss) {
          logger.debug('Loss not found for killmail ID', {
            correlationId,
            killmailId: killmailId.toString(),
          });
          return null;
        }

        logger.debug('Successfully fetched loss by killmail ID', {
          correlationId,
          killmailId: killmailId.toString(),
        });

        return PrismaMapper.map(loss, LossFact);
      },
      'getLoss',
      correlationId
    );
  }

  /**
   * Get all losses for a character
   * @param characterId Character EVE ID
   * @param startDate Start date for query range
   * @param endDate End date for query range
   */
  async getLossesForCharacter(characterId: bigint, startDate: Date, endDate: Date): Promise<LossFact[]> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Fetching losses for character', {
          correlationId,
          characterId: characterId.toString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const losses = await this.prisma.lossFact.findMany({
          where: {
            characterId: characterId,
            killTime: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: {
            killTime: 'desc',
          },
        });

        const lossFacts = PrismaMapper.mapArray(losses, LossFact);

        logger.debug('Successfully fetched losses for character', {
          correlationId,
          characterId: characterId.toString(),
          lossCount: lossFacts.length,
        });

        return lossFacts;
      },
      'getLossesForCharacter',
      correlationId
    );
  }

  /**
   * Save a loss record
   * @param loss LossFact domain entity to save
   */
  async saveLoss(loss: LossFact): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Saving loss record', {
          correlationId,
          killmailId: loss.killmailId.toString(),
          characterId: loss.characterId.toString(),
        });

        // Check if this character is tracked (exists in characters table)
        const trackedCharacter = await this.prisma.character.findUnique({
          where: { eveId: loss.characterId },
          select: { eveId: true },
        });

        if (!trackedCharacter) {
          logger.debug('Skipping loss save for untracked character', {
            correlationId,
            characterId: loss.characterId.toString(),
          });
          return;
        }

        const data = loss.toObject();
        await this.prisma.lossFact.upsert({
          where: { killmailId: loss.killmailId },
          update: {
            killTime: data.killTime,
            systemId: data.systemId,
            totalValue: data.totalValue,
            attackerCount: data.attackerCount,
            labels: data.labels,
            characterId: data.characterId,
            shipTypeId: data.shipTypeId,
          },
          create: {
            killmailId: data.killmailId,
            killTime: data.killTime,
            systemId: data.systemId,
            totalValue: data.totalValue,
            attackerCount: data.attackerCount,
            labels: data.labels,
            characterId: data.characterId,
            shipTypeId: data.shipTypeId,
          },
        });

        logger.debug('Successfully saved loss record', {
          correlationId,
          killmailId: loss.killmailId.toString(),
          characterId: loss.characterId.toString(),
        });
      },
      'saveLoss',
      correlationId
    );
  }

  /**
   * Delete all loss records
   */
  async deleteAllLosses(): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Deleting all loss records', { correlationId });

        const result = await this.prisma.lossFact.deleteMany();

        logger.debug('Successfully deleted all loss records', {
          correlationId,
          deletedCount: result.count,
        });
      },
      'deleteAllLosses',
      correlationId
    );
  }

  /**
   * Get losses within a time range
   * @param startDate Start date for query range
   * @param endDate End date for query range
   */
  async getLossesByTimeRange(startDate: Date, endDate: Date): Promise<LossFact[]> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Fetching losses by time range', {
          correlationId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const losses = await this.prisma.lossFact.findMany({
          where: {
            killTime: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: {
            killTime: 'desc',
          },
        });

        const lossFacts = PrismaMapper.mapArray(losses, LossFact);

        logger.debug('Successfully fetched losses by time range', {
          correlationId,
          lossCount: lossFacts.length,
        });

        return lossFacts;
      },
      'getLossesByTimeRange',
      correlationId
    );
  }

  /**
   * Count total loss records
   */
  override async count(): Promise<number> {
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Counting total loss records', { correlationId });

        const count = await this.prisma.lossFact.count();

        logger.debug('Successfully counted loss records', {
          correlationId,
          count,
        });

        return count;
      },
      'count',
      correlationId
    );
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
    const correlationId = errorHandler.createCorrelationId();

    return this.executeQuery(
      async () => {
        logger.debug('Fetching top ship types lost', {
          correlationId,
          characterCount: characterIds.length,
          characterIds: characterIds.map(id => id.toString()),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit,
        });

        // Find all losses for these characters in the date range
        const losses = await this.prisma.lossFact.findMany({
          where: {
            characterId: {
              in: characterIds.map(id => BigInt(id)),
            },
            killTime: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            shipTypeId: true,
          },
        });

        // Count occurrences of each ship type
        const shipTypeCounts = new Map<string, number>();
        for (const loss of losses) {
          const shipTypeId = loss.shipTypeId.toString();
          shipTypeCounts.set(shipTypeId, (shipTypeCounts.get(shipTypeId) ?? 0) + 1);
        }

        const topShipTypes = Array.from(shipTypeCounts.entries())
          .map(([shipTypeId, count]) => ({ shipTypeId, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);

        logger.debug('Successfully fetched top ship types lost', {
          correlationId,
          totalShipTypes: shipTypeCounts.size,
          topShipTypesCount: topShipTypes.length,
        });

        return topShipTypes;
      },
      'getTopShipTypesLost',
      correlationId
    );
  }
}
