import { PrismaClient } from '@prisma/client';
/* eslint-disable max-lines */
import { logger } from '../../lib/logger';

/**
 * Simplified Kill Repository for WebSocket-based ingestion
 * No longer handles partial killmails since WebSocket provides complete data
 */
export class KillRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Ingest a complete killmail from WebSocket data
   */
  async ingestKillmail(
    killFact: {
      killmail_id: bigint;
      kill_time: Date;
      npc: boolean;
      solo: boolean;
      awox: boolean;
      ship_type_id: number;
      system_id: number;
      labels: string[];
      total_value: bigint;
      points: number;
    },
    victim: {
      character_id?: bigint;
      corporation_id?: bigint;
      alliance_id?: bigint;
      ship_type_id: number;
      damage_taken: number;
    },
    attackers: Array<{
      character_id?: bigint;
      corporation_id?: bigint;
      alliance_id?: bigint;
      damage_done: number;
      final_blow: boolean;
      security_status?: number;
      ship_type_id?: number;
      weapon_type_id?: number;
    }>,
    involvedCharacters: Array<{
      character_id: bigint;
      role: 'attacker' | 'victim';
    }>
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async tx => {
        await this.upsertKillFacts(killFact, tx);
        await this.processVictimData(killFact.killmail_id, victim, tx);
        await this.processAttackerData(killFact.killmail_id, attackers, tx);
        await this.manageCharacterRelationships(killFact.killmail_id, involvedCharacters, tx);
        await this.createLossFact(killFact, victim, attackers, tx);
      });

      logger.debug(`Successfully ingested killmail ${killFact.killmail_id}`);
    } catch (error) {
      logger.error(`Failed to ingest killmail ${killFact.killmail_id}`, error);
      throw error;
    }
  }

  private async upsertKillFacts(
    killFact: {
      killmail_id: bigint;
      kill_time: Date;
      npc: boolean;
      solo: boolean;
      awox: boolean;
      ship_type_id: number;
      system_id: number;
      labels: string[];
      total_value: bigint;
      points: number;
    },
    tx: any
  ): Promise<void> {
    await tx.killFact.upsert({
      where: { killmail_id: killFact.killmail_id },
      create: killFact,
      update: killFact,
    });
  }

  private async processVictimData(
    killmailId: bigint,
    victim: {
      character_id?: bigint;
      corporation_id?: bigint;
      alliance_id?: bigint;
      ship_type_id: number;
      damage_taken: number;
    },
    tx: any
  ): Promise<void> {
    await tx.killVictim.deleteMany({
      where: { killmail_id: killmailId },
    });

    await tx.killVictim.create({
      data: {
        killmail_id: killmailId,
        character_id: victim.character_id ?? null,
        corporation_id: victim.corporation_id ?? null,
        alliance_id: victim.alliance_id ?? null,
        ship_type_id: victim.ship_type_id,
        damage_taken: victim.damage_taken,
      },
    });
  }

  private async processAttackerData(
    killmailId: bigint,
    attackers: Array<{
      character_id?: bigint;
      corporation_id?: bigint;
      alliance_id?: bigint;
      damage_done: number;
      final_blow: boolean;
      security_status?: number;
      ship_type_id?: number;
      weapon_type_id?: number;
    }>,
    tx: any
  ): Promise<void> {
    await tx.killAttacker.deleteMany({
      where: { killmail_id: killmailId },
    });

    // Use Promise.all for parallel attacker creation instead of sequential loop
    await Promise.all(
      attackers.map(attacker =>
        tx.killAttacker.create({
          data: {
            killmail_id: killmailId,
            character_id: attacker.character_id ?? null,
            corporation_id: attacker.corporation_id ?? null,
            alliance_id: attacker.alliance_id ?? null,
            damage_done: attacker.damage_done,
            final_blow: attacker.final_blow,
            security_status: attacker.security_status ?? null,
            ship_type_id: attacker.ship_type_id ?? null,
            weapon_type_id: attacker.weapon_type_id ?? null,
          },
        })
      )
    );
  }

  private async manageCharacterRelationships(
    killmailId: bigint,
    involvedCharacters: Array<{
      character_id: bigint;
      role: 'attacker' | 'victim';
    }>,
    tx: any
  ): Promise<void> {
    await tx.killCharacter.deleteMany({
      where: { killmail_id: killmailId },
    });

    for (const character of involvedCharacters) {
      const isTracked = await tx.character.findUnique({
        where: { eveId: character.character_id },
        select: { eveId: true },
      });

      if (isTracked) {
        await tx.killCharacter.create({
          data: {
            killmail_id: killmailId,
            character_id: character.character_id,
            role: character.role,
          },
        });
      }
    }
  }

  private async createLossFact(
    killFact: {
      killmail_id: bigint;
      kill_time: Date;
      system_id: number;
      total_value: bigint;
      labels: string[];
    },
    victim: {
      character_id?: bigint;
      ship_type_id: number;
    },
    attackers: Array<any>,
    tx: any
  ): Promise<void> {
    if (!victim.character_id) return;

    const isTrackedVictim = await tx.character.findUnique({
      where: { eveId: victim.character_id },
      select: { eveId: true },
    });

    if (isTrackedVictim) {
      await tx.lossFact.upsert({
        where: { killmail_id: killFact.killmail_id },
        create: {
          killmail_id: killFact.killmail_id,
          character_id: victim.character_id,
          kill_time: killFact.kill_time,
          ship_type_id: victim.ship_type_id,
          system_id: killFact.system_id,
          total_value: killFact.total_value,
          attacker_count: attackers.length,
          labels: killFact.labels,
        },
        update: {
          kill_time: killFact.kill_time,
          ship_type_id: victim.ship_type_id,
          system_id: killFact.system_id,
          total_value: killFact.total_value,
          attacker_count: attackers.length,
          labels: killFact.labels,
        },
      });
    }
  }

  /**
   * Get kills for a character within a date range
   */
  async getKillsForCharacter(characterId: bigint, startDate: Date, endDate: Date): Promise<any[]> {
    return this.prisma.killFact.findMany({
      where: {
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
        characters: {
          some: {
            character_id: characterId,
          },
        },
      },
      include: {
        attackers: true,
        victims: true,
        characters: true,
      },
      orderBy: {
        kill_time: 'desc',
      },
    });
  }

  /**
   * Get kills for multiple characters within a date range
   */
  async getKillsForCharacters(characterIds: bigint[], startDate: Date, endDate: Date): Promise<any[]> {
    return this.prisma.killFact.findMany({
      where: {
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
        characters: {
          some: {
            character_id: {
              in: characterIds,
            },
          },
        },
      },
      include: {
        attackers: true,
        victims: true,
        characters: true,
      },
      orderBy: {
        kill_time: 'desc',
      },
    });
  }

  /**
   * Get kills for a character group within a date range
   */
  async getKillsForGroup(groupId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const group = await this.prisma.characterGroup.findUnique({
      where: { id: groupId },
      include: { characters: true },
    });

    if (!group) {
      return [];
    }

    const characterIds = group.characters.map(c => c.eveId);
    return this.getKillsForCharacters(characterIds, startDate, endDate);
  }

  /**
   * Check if a killmail exists
   */
  async killmailExists(killmailId: bigint): Promise<boolean> {
    const count = await this.prisma.killFact.count({
      where: { killmail_id: killmailId },
    });
    return count > 0;
  }

  /**
   * Get total kill count for a character
   */
  async getKillCount(characterId: bigint): Promise<number> {
    return this.prisma.killCharacter.count({
      where: {
        character_id: characterId,
        role: 'attacker',
      },
    });
  }

  /**
   * Get total loss count for a character
   */
  async getLossCount(characterId: bigint): Promise<number> {
    return this.prisma.lossFact.count({
      where: {
        character_id: characterId,
      },
    });
  }

  /**
   * Placeholder implementations for chart generators
   * These can be enhanced later with proper implementations
   */
  async getAllKillsForCharacters(characterIds: bigint[], startDate: Date, endDate: Date): Promise<any[]> {
    return this.getKillsForCharacters(characterIds, startDate, endDate);
  }

  async getTopShipTypesUsed(_characterIds: bigint[], _startDate: Date, _endDate: Date, _limit = 10): Promise<any[]> {
    void _characterIds;
    void _startDate;
    void _endDate;
    void _limit;
    logger.warn('Method not yet implemented: getTopShipTypesUsed');
    return [];
  }

  async getTopEnemyCorporations(
    _characterIds: bigint[],
    _startDate: Date,
    _endDate: Date,
    _limit = 10
  ): Promise<any[]> {
    void _characterIds;
    void _startDate;
    void _endDate;
    void _limit;
    logger.warn('Method not yet implemented: getTopEnemyCorporations');
    return [];
  }

  async getDistributionData(_characterIds: bigint[], _startDate: Date, _endDate: Date): Promise<any[]> {
    void _characterIds;
    void _startDate;
    void _endDate;
    logger.warn('Method not yet implemented: getDistributionData');
    return [];
  }

  async getKillActivityByTimeOfDay(_characterIds: bigint[], _startDate: Date, _endDate: Date): Promise<any[]> {
    void _characterIds;
    void _startDate;
    void _endDate;
    logger.warn('Method not yet implemented: getKillActivityByTimeOfDay');
    return [];
  }

  async getKillsGroupedByTime(
    _characterIds: bigint[],
    _startDate: Date,
    _endDate: Date,
    _interval: string
  ): Promise<any[]> {
    void _characterIds;
    void _startDate;
    void _endDate;
    void _interval;
    logger.warn('Method not yet implemented: getKillsGroupedByTime');
    return [];
  }

  async getTopShipTypesDestroyed(
    _characterIds: bigint[],
    _startDate: Date,
    _endDate: Date,
    _limit = 10
  ): Promise<any[]> {
    void _characterIds;
    void _startDate;
    void _endDate;
    void _limit;
    logger.warn('Method not yet implemented: getTopShipTypesDestroyed');
    return [];
  }

  async getShipTypesOverTime(
    _characterIds: bigint[],
    _startDate: Date,
    _endDate: Date,
    _interval: string
  ): Promise<any> {
    void _characterIds;
    void _startDate;
    void _endDate;
    void _interval;
    logger.warn('Method not yet implemented: getShipTypesOverTime');
    return {};
  }
}
