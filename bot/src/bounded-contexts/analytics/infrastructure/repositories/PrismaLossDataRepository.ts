/**
 * Prisma implementation of LossDataRepository
 * Infrastructure layer - handles data access using Prisma ORM
 */

import type { LossDataRepository, LossDataPoint } from '../../application/use-cases/GenerateChartUseCase';
import { PrismaClient } from '@prisma/client';

export class PrismaLossDataRepository implements LossDataRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getLossDataForCharacters(
    characterIds: bigint[],
    startDate: Date,
    endDate: Date
  ): Promise<LossDataPoint[]> {
    // Query the database using the new camelCase properties
    const lossFacts = await this.prisma.lossFact.findMany({
      where: {
        killTime: {
          gte: startDate,
          lte: endDate
        },
        characterId: {
          in: characterIds
        }
      },
      select: {
        killTime: true,
        killmailId: true,
        characterId: true,
        totalValue: true,
        shipTypeId: true
      },
      orderBy: {
        killTime: 'desc'
      }
    });

    // Transform database records to domain objects (now using camelCase)
    return lossFacts.map((lossFact: any) => ({
      killTime: lossFact.killTime,
      killmailId: lossFact.killmailId,
      characterId: lossFact.characterId,
      totalValue: lossFact.totalValue,
      shipTypeId: lossFact.shipTypeId,
      systemId: lossFact.systemId
    }));
  }
}