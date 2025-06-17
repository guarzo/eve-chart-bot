/**
 * Prisma implementation of KillDataRepository
 * Infrastructure layer - handles data access using Prisma ORM
 */

import type { KillDataRepository, KillDataPoint } from '../../application/use-cases/GenerateChartUseCase';
import { PrismaClient } from '@prisma/client';

export class PrismaKillDataRepository implements KillDataRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getKillDataForCharacters(characterIds: bigint[], startDate: Date, endDate: Date): Promise<KillDataPoint[]> {
    // Query the database using the new camelCase properties
    const killFacts = await this.prisma.killFact.findMany({
      where: {
        killTime: {
          gte: startDate,
          lte: endDate,
        },
        attackers: {
          some: {
            characterId: {
              in: characterIds,
            },
          },
        },
      },
      include: {
        attackers: {
          where: {
            characterId: {
              in: characterIds,
            },
          },
          select: {
            characterId: true,
          },
        },
      },
      orderBy: {
        killTime: 'desc',
      },
    });

    // Transform database records to domain objects (now using camelCase)
    return killFacts.map((killFact: any) => ({
      killTime: killFact.killTime,
      killmailId: killFact.killmailId,
      characterId: killFact.attackers[0]?.characterId || BigInt(0),
      solo: killFact.solo,
      npc: killFact.npc,
    }));
  }
}
