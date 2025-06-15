import { PrismaClient } from '@prisma/client';
/* eslint-disable max-lines */
import { logger } from '../../lib/logger';
import { errorHandler, DatabaseError } from '../../shared/errors';

/**
 * Simplified Kill Repository for WebSocket-based ingestion
 * No longer handles partial killmails since WebSocket provides complete data
 * Updated to use camelCase properties matching the new Prisma schema
 */
export class KillRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Ingest a complete killmail from WebSocket data
   */
  async ingestKillmail(
    killFact: {
      killmailId: bigint;
      killTime: Date;
      npc: boolean;
      solo: boolean;
      awox: boolean;
      shipTypeId: number;
      systemId: number;
      labels: string[];
      totalValue: bigint;
      points: number;
    },
    victim: {
      characterId?: bigint;
      corporationId?: bigint;
      allianceId?: bigint;
      shipTypeId: number;
      damageTaken: number;
    },
    attackers: Array<{
      characterId?: bigint;
      corporationId?: bigint;
      allianceId?: bigint;
      damageDone: number;
      finalBlow: boolean;
      securityStatus?: number;
      shipTypeId?: number;
      weaponTypeId?: number;
    }>,
    involvedCharacters: Array<{
      characterId: bigint;
      role: 'attacker' | 'victim';
    }>
  ): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();
    const startTime = Date.now();

    try {
      // Use transaction for consistency
      await this.prisma.$transaction(async (tx) => {
        // 1. Upsert kill fact
        await this.upsertKillFacts(tx, killFact, correlationId);

        // 2. Process victim data
        await this.processVictimData(tx, killFact.killmailId, victim, correlationId);

        // 3. Process attacker data
        await this.processAttackerData(tx, killFact.killmailId, attackers, correlationId);

        // 4. Manage character relationships
        await this.manageCharacterRelationships(tx, killFact.killmailId, involvedCharacters, correlationId);

        // 5. Create loss fact if victim is tracked
        if (victim.characterId) {
          await this.createLossFact(tx, killFact, victim, attackers, correlationId);
        }
      });

      const duration = Date.now() - startTime;
      logger.info(`Killmail ${killFact.killmailId} ingested successfully`, {
        duration,
        involvedCount: involvedCharacters.length,
        attackerCount: attackers.length,
        correlationId
      });
    } catch (error) {
      logger.error('Failed to ingest killmail', {
        error,
        killmailId: killFact.killmailId?.toString(),
        correlationId
      });
      
      throw new DatabaseError('KILL_INGESTION_FAILED', 'Failed to ingest killmail', {
        cause: error,
        context: { killmailId: killFact.killmailId?.toString(), correlationId }
      });
    }
  }

  /**
   * Upsert kill fact data
   */
  private async upsertKillFacts(
    tx: any,
    killFact: {
      killmailId: bigint;
      killTime: Date;
      npc: boolean;
      solo: boolean;
      awox: boolean;
      shipTypeId: number;
      systemId: number;
      labels: string[];
      totalValue: bigint;
      points: number;
    },
    correlationId: string
  ): Promise<void> {
    await tx.killFact.upsert({
      where: { killmailId: killFact.killmailId },
      update: {
        killTime: killFact.killTime,
        npc: killFact.npc,
        solo: killFact.solo,
        awox: killFact.awox,
        shipTypeId: killFact.shipTypeId,
        systemId: killFact.systemId,
        labels: killFact.labels,
        totalValue: killFact.totalValue,
        points: killFact.points,
      },
      create: killFact,
    });

    logger.debug('Kill fact upserted', {
      killmailId: killFact.killmailId.toString(),
      correlationId
    });
  }

  /**
   * Process victim data for a killmail
   */
  private async processVictimData(
    tx: any,
    killmailId: bigint,
    victim: {
      characterId?: bigint;
      corporationId?: bigint;
      allianceId?: bigint;
      shipTypeId: number;
      damageTaken: number;
    },
    correlationId: string
  ): Promise<void> {
    // Delete existing victims for this killmail (should be only one)
    await tx.killVictim.deleteMany({
      where: { killmailId }
    });

    // Create victim record
    await tx.killVictim.create({
      data: {
        killmailId,
        characterId: victim.characterId,
        corporationId: victim.corporationId,
        allianceId: victim.allianceId,
        shipTypeId: victim.shipTypeId,
        damageTaken: victim.damageTaken,
      }
    });

    logger.debug('Victim data processed', {
      killmailId: killmailId.toString(),
      hasCharacter: !!victim.characterId,
      correlationId
    });
  }

  /**
   * Process attacker data for a killmail
   */
  private async processAttackerData(
    tx: any,
    killmailId: bigint,
    attackers: Array<{
      characterId?: bigint;
      corporationId?: bigint;
      allianceId?: bigint;
      damageDone: number;
      finalBlow: boolean;
      securityStatus?: number;
      shipTypeId?: number;
      weaponTypeId?: number;
    }>,
    correlationId: string
  ): Promise<void> {
    // Delete existing attackers
    await tx.killAttacker.deleteMany({
      where: { killmailId }
    });

    // Create attackers in parallel for performance
    await Promise.all(
      attackers.map(attacker =>
        tx.killAttacker.create({
          data: {
            killmailId,
            characterId: attacker.characterId,
            corporationId: attacker.corporationId,
            allianceId: attacker.allianceId,
            damageDone: attacker.damageDone,
            finalBlow: attacker.finalBlow,
            securityStatus: attacker.securityStatus,
            shipTypeId: attacker.shipTypeId,
            weaponTypeId: attacker.weaponTypeId,
          }
        })
      )
    );

    logger.debug('Attacker data processed', {
      killmailId: killmailId.toString(),
      attackerCount: attackers.length,
      correlationId
    });
  }

  /**
   * Manage character relationships for tracking
   */
  private async manageCharacterRelationships(
    tx: any,
    killmailId: bigint,
    involvedCharacters: Array<{
      characterId: bigint;
      role: 'attacker' | 'victim';
    }>,
    correlationId: string
  ): Promise<void> {
    // Delete existing relationships
    await tx.killCharacter.deleteMany({
      where: { killmailId }
    });

    // Create new relationships
    if (involvedCharacters.length > 0) {
      await tx.killCharacter.createMany({
        data: involvedCharacters.map(char => ({
          killmailId,
          characterId: char.characterId,
          role: char.role
        }))
      });
    }

    logger.debug('Character relationships updated', {
      killmailId: killmailId.toString(),
      relationshipCount: involvedCharacters.length,
      correlationId
    });
  }

  /**
   * Create loss fact for tracked victim
   */
  private async createLossFact(
    tx: any,
    killFact: {
      killmailId: bigint;
      killTime: Date;
      systemId: number;
      totalValue: bigint;
    },
    victim: {
      characterId?: bigint;
      shipTypeId: number;
    },
    attackers: Array<any>,
    correlationId: string
  ): Promise<void> {
    if (!victim.characterId) return;

    const character = await tx.character.findUnique({
      where: { eveId: victim.characterId }
    });

    if (!character) {
      logger.debug('Victim character not tracked, skipping loss fact', {
        killmailId: killFact.killmailId.toString(),
        victimId: victim.characterId.toString(),
        correlationId
      });
      return;
    }

    await tx.lossFact.upsert({
      where: { killmailId: killFact.killmailId },
      update: {
        killTime: killFact.killTime,
        systemId: killFact.systemId,
        totalValue: killFact.totalValue,
        attackerCount: attackers.length,
        labels: [],
      },
      create: {
        killmailId: killFact.killmailId,
        characterId: victim.characterId,
        killTime: killFact.killTime,
        shipTypeId: victim.shipTypeId,
        systemId: killFact.systemId,
        totalValue: killFact.totalValue,
        attackerCount: attackers.length,
        labels: [],
      }
    });

    logger.debug('Loss fact created', {
      killmailId: killFact.killmailId.toString(),
      victimId: victim.characterId.toString(),
      correlationId
    });
  }

  /**
   * Get kills for specific characters in a time range
   */
  async getKillsForCharacters(
    characterIds: bigint[],
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    return this.prisma.killFact.findMany({
      where: {
        killTime: {
          gte: startDate,
          lte: endDate,
        },
        characters: {
          some: {
            characterId: {
              in: characterIds,
            },
            role: 'attacker',
          },
        },
      },
      include: {
        attackers: true,
        victims: true,
      },
      orderBy: {
        killTime: 'desc',
      },
    });
  }

  /**
   * Get all kills where characters appear as either attacker or victim
   */
  async getAllKillsForCharacters(
    characterIds: bigint[],
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    return this.prisma.killFact.findMany({
      where: {
        killTime: {
          gte: startDate,
          lte: endDate,
        },
        characters: {
          some: {
            characterId: {
              in: characterIds,
            },
          },
        },
      },
      include: {
        attackers: true,
        victims: true,
      },
      orderBy: {
        killTime: 'desc',
      },
    });
  }

  /**
   * Check if a killmail already exists
   */
  async killmailExists(killmailId: bigint): Promise<boolean> {
    const count = await this.prisma.killFact.count({
      where: { killmailId },
    });
    return count > 0;
  }

  /**
   * Get kill count for a character
   */
  async getKillCount(characterId: bigint, startDate?: Date, endDate?: Date): Promise<number> {
    return this.prisma.killCharacter.count({
      where: {
        characterId,
        role: 'attacker',
        kill: {
          killTime: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
    });
  }

  /**
   * Get loss count for a character
   */
  async getLossCount(characterId: bigint, startDate?: Date, endDate?: Date): Promise<number> {
    return this.prisma.killCharacter.count({
      where: {
        characterId,
        role: 'victim',
        kill: {
          killTime: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
    });
  }

  // Placeholder methods that return empty results with warning logs
  async getTopKillers(_limit = 10): Promise<any[]> {
    logger.warn('Method not yet implemented: getTopKillers');
    return [];
  }

  async getKillsInDateRange(_start: Date, _end: Date): Promise<any[]> {
    logger.warn('Method not yet implemented: getKillsInDateRange');
    return [];
  }

  async getShipTypesOverTime(_startDate: Date, _endDate: Date, _limit = 10): Promise<any[]> {
    logger.warn('Method not yet implemented: getShipTypesOverTime');
    return [];
  }

  /**
   * Get top ship types used by characters
   */
  async getTopShipTypesUsed(
    characterIds: bigint[],
    startDate: Date,
    endDate: Date,
    limit: number
  ): Promise<Array<{ shipTypeId: number; count: number }>> {
    try {
      const result = await this.prisma.killAttacker.groupBy({
        by: ['shipTypeId'],
        where: {
          characterId: { in: characterIds },
          shipTypeId: { not: null },
          kill: {
            killTime: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        _count: {
          shipTypeId: true,
        },
        orderBy: {
          _count: {
            shipTypeId: 'desc',
          },
        },
        take: limit,
      });

      return result.map(r => ({
        shipTypeId: r.shipTypeId!,
        count: r._count.shipTypeId,
      }));
    } catch (error) {
      logger.error('Failed to get top ship types used', error);
      throw new DatabaseError('QUERY_FAILED', 'Failed to get top ship types used', {
        cause: error,
        context: { characterIds: characterIds.map(id => id.toString()), startDate, endDate, limit }
      });
    }
  }

  /**
   * Get top ship types destroyed by characters
   */
  async getTopShipTypesDestroyed(
    characterIds: bigint[],
    startDate: Date,
    endDate: Date,
    limit: number
  ): Promise<Array<{ shipTypeId: number; count: number }>> {
    try {
      const result = await this.prisma.killVictim.groupBy({
        by: ['shipTypeId'],
        where: {
          kill: {
            killTime: {
              gte: startDate,
              lte: endDate,
            },
            attackers: {
              some: {
                characterId: { in: characterIds },
              },
            },
          },
        },
        _count: {
          shipTypeId: true,
        },
        orderBy: {
          _count: {
            shipTypeId: 'desc',
          },
        },
        take: limit,
      });

      return result.map(r => ({
        shipTypeId: r.shipTypeId,
        count: r._count.shipTypeId,
      }));
    } catch (error) {
      logger.error('Failed to get top ship types destroyed', error);
      throw new DatabaseError('QUERY_FAILED', 'Failed to get top ship types destroyed', {
        cause: error,
        context: { characterIds: characterIds.map(id => id.toString()), startDate, endDate, limit }
      });
    }
  }

  /**
   * Get kills grouped by time for trend analysis
   */
  async getKillsGroupedByTime(
    characterIds: bigint[],
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'day' | 'week'
  ): Promise<Array<{ time: Date; count: number }>> {
    try {
      // For now, use raw SQL for time grouping as Prisma doesn't support it natively
      const interval = groupBy === 'hour' ? '1 hour' : groupBy === 'day' ? '1 day' : '1 week';
      
      const result = await this.prisma.$queryRaw<Array<{ time: Date; count: bigint }>>`
        SELECT 
          date_trunc(${groupBy}, kf."killTime") as time,
          COUNT(DISTINCT kf."killmailId")::bigint as count
        FROM "KillFact" kf
        INNER JOIN "KillCharacter" kc ON kc."killmailId" = kf."killmailId"
        WHERE kc."characterId" = ANY(${characterIds})
          AND kc."role" = 'attacker'
          AND kf."killTime" >= ${startDate}
          AND kf."killTime" <= ${endDate}
        GROUP BY date_trunc(${groupBy}, kf."killTime")
        ORDER BY time ASC
      `;

      return result.map(r => ({
        time: r.time,
        count: Number(r.count),
      }));
    } catch (error) {
      logger.error('Failed to get kills grouped by time', error);
      throw new DatabaseError('QUERY_FAILED', 'Failed to get kills grouped by time', {
        cause: error,
        context: { characterIds: characterIds.map(id => id.toString()), startDate, endDate, groupBy }
      });
    }
  }
}