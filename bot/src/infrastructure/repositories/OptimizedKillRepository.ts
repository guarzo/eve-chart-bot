import { PrismaClient, KillAttacker, KillCharacter, Character } from '@prisma/client';
import { logger } from '../../lib/logger';
import { errorHandler, DatabaseError } from '../../shared/errors';

/**
 * Optimized Kill Repository with efficient database operations
 * Replaces delete/insert cycles with upsert operations and diff-based updates
 */
export class OptimizedKillRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Ingest a complete killmail with optimized database operations
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
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      await errorHandler.withRetry(
        async () => {
          await this.prisma.$transaction(async tx => {
            // Upsert kill fact (no change needed - already optimized)
            await this.upsertKillFacts(killFact, tx, correlationId);
            
            // Optimized victim processing with upsert
            await this.upsertVictimData(killFact.killmail_id, victim, tx, correlationId);
            
            // Optimized attacker processing with diff-based updates
            await this.syncAttackerData(killFact.killmail_id, attackers, tx, correlationId);
            
            // Optimized character relationships with diff-based updates
            await this.syncCharacterRelationships(killFact.killmail_id, involvedCharacters, tx, correlationId);
            
            // Create loss fact (no change needed)
            await this.createLossFact(killFact, victim, attackers, tx, correlationId);
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'db.ingestKillmail.optimized',
          metadata: {
            killmailId: killFact.killmail_id.toString(),
            characterCount: involvedCharacters.length,
            attackerCount: attackers.length,
          },
        }
      );

      logger.debug(`Successfully ingested killmail ${killFact.killmail_id} (optimized)`, {
        correlationId,
        killmailId: killFact.killmail_id.toString(),
      });
    } catch (error) {
      throw errorHandler.handleError(
        error,
        {
          operation: 'ingestKillmail.optimized',
          correlationId,
          metadata: {
            service: 'OptimizedKillRepository',
            killmailId: killFact.killmail_id.toString(),
            characterCount: involvedCharacters.length,
            attackerCount: attackers.length,
            entityId: involvedCharacters[0]?.character_id?.toString(),
            entityType: 'kill_fact',
          },
        }
      );
    }
  }

  /**
   * Upsert kill facts (already optimized in original)
   */
  private async upsertKillFacts(
    killFact: any,
    tx: any,
    correlationId: string
  ): Promise<void> {
    try {
      await tx.killFact.upsert({
        where: { killmail_id: killFact.killmail_id },
        update: {
          kill_time: killFact.kill_time,
          npc: killFact.npc,
          solo: killFact.solo,
          awox: killFact.awox,
          ship_type_id: killFact.ship_type_id,
          system_id: killFact.system_id,
          labels: killFact.labels,
          total_value: killFact.total_value,
          points: killFact.points,
        },
        create: {
          killmail_id: killFact.killmail_id,
          kill_time: killFact.kill_time,
          npc: killFact.npc,
          solo: killFact.solo,
          awox: killFact.awox,
          ship_type_id: killFact.ship_type_id,
          system_id: killFact.system_id,
          labels: killFact.labels,
          total_value: killFact.total_value,
          points: killFact.points,
        },
      });

      logger.debug(`Upserted kill fact ${killFact.killmail_id}`, { correlationId });
    } catch (error) {
      throw errorHandler.handleError(
        error,
        {
          operation: 'upsertKillFacts',
          correlationId,
          metadata: {
            service: 'OptimizedKillRepository',
            killmailId: killFact.killmail_id.toString(),
            entityType: 'kill_fact',
          },
        }
      );
    }
  }

  /**
   * Optimized victim processing using upsert instead of delete/insert
   */
  private async upsertVictimData(
    killmailId: bigint,
    victim: {
      character_id?: bigint;
      corporation_id?: bigint;
      alliance_id?: bigint;
      ship_type_id: number;
      damage_taken: number;
    },
    tx: any,
    correlationId: string
  ): Promise<void> {
    try {
      await tx.killVictim.upsert({
        where: { 
          killmail_id: killmailId 
        },
        update: {
          character_id: victim.character_id ?? null,
          corporation_id: victim.corporation_id ?? null,
          alliance_id: victim.alliance_id ?? null,
          ship_type_id: victim.ship_type_id,
          damage_taken: victim.damage_taken,
        },
        create: {
          killmail_id: killmailId,
          character_id: victim.character_id ?? null,
          corporation_id: victim.corporation_id ?? null,
          alliance_id: victim.alliance_id ?? null,
          ship_type_id: victim.ship_type_id,
          damage_taken: victim.damage_taken,
        },
      });

      logger.debug(`Upserted victim for killmail ${killmailId}`, { correlationId });
    } catch (error) {
      throw errorHandler.handleError(
        error,
        {
          operation: 'upsertVictimData',
          correlationId,
          metadata: {
            service: 'OptimizedKillRepository',
            killmailId: killmailId.toString(),
            entityType: 'kill_victim',
          },
        }
      );
    }
  }

  /**
   * Optimized attacker processing with diff-based updates
   * Only updates/creates/deletes what has actually changed
   */
  private async syncAttackerData(
    killmailId: bigint,
    newAttackers: Array<{
      character_id?: bigint;
      corporation_id?: bigint;
      alliance_id?: bigint;
      damage_done: number;
      final_blow: boolean;
      security_status?: number;
      ship_type_id?: number;
      weapon_type_id?: number;
    }>,
    tx: any,
    correlationId: string
  ): Promise<void> {
    try {
      // Get existing attackers for this killmail
      const existingAttackers = await tx.killAttacker.findMany({
        where: { killmail_id: killmailId },
      });

      // Create normalized attacker data for comparison
      const newAttackerData = newAttackers.map((attacker, index) => ({
        killmailId: killmailId,
        characterId: attacker.character_id ?? null,
        corporationId: attacker.corporation_id ?? null,
        allianceId: attacker.alliance_id ?? null,
        damageDone: attacker.damage_done,
        finalBlow: attacker.final_blow,
        securityStatus: attacker.security_status ?? null,
        shipTypeId: attacker.ship_type_id ?? null,
        weaponTypeId: attacker.weapon_type_id ?? null,
        // Use index as unique identifier for this killmail
        temp_index: index,
      }));

      // Find attackers to delete (exist in DB but not in new data)
      // const _existingIds = new Set(existingAttackers.map((a: KillAttacker) => a.id));
      const attackersToDelete = existingAttackers.filter((existing: KillAttacker, index: number) => {
        // Compare with new data at same index, or mark for deletion if index doesn't exist
        const newAttacker = newAttackerData[index];
        return !newAttacker || !this.attackersEqual(existing, newAttacker);
      });

      // Find attackers to create/update
      const attackersToUpsert = newAttackerData.filter((newAttacker, index: number) => {
        const existing = existingAttackers[index];
        return !existing || !this.attackersEqual(existing, newAttacker);
      });

      // Perform deletions if any attackers were removed or changed
      if (attackersToDelete.length > 0) {
        await tx.killAttacker.deleteMany({
          where: {
            id: { in: attackersToDelete.map((a: KillAttacker) => a.id) },
          },
        });
        logger.debug(`Deleted ${attackersToDelete.length} attackers for killmail ${killmailId}`, { correlationId });
      }

      // Perform batch creation for new/changed attackers
      if (attackersToUpsert.length > 0) {
        await tx.killAttacker.createMany({
          data: attackersToUpsert.map(({ temp_index, ...data }) => data),
          skipDuplicates: true,
        });
        logger.debug(`Created ${attackersToUpsert.length} attackers for killmail ${killmailId}`, { correlationId });
      }
    } catch (error) {
      throw errorHandler.handleError(
        error,
        {
          operation: 'syncAttackerData',
          correlationId,
          metadata: {
            service: 'OptimizedKillRepository',
            killmailId: killmailId.toString(),
            entityType: 'kill_attacker',
          },
        }
      );
    }
  }

  /**
   * Compare two attackers for equality
   */
  private attackersEqual(existing: KillAttacker, newAttacker: Partial<KillAttacker>): boolean {
    return (
      existing.characterId === newAttacker.characterId &&
      existing.corporationId === newAttacker.corporationId &&
      existing.allianceId === newAttacker.allianceId &&
      existing.damageDone === newAttacker.damageDone &&
      existing.finalBlow === newAttacker.finalBlow &&
      existing.securityStatus === newAttacker.securityStatus &&
      existing.shipTypeId === newAttacker.shipTypeId &&
      existing.weaponTypeId === newAttacker.weaponTypeId
    );
  }

  /**
   * Optimized character relationships with diff-based updates
   */
  private async syncCharacterRelationships(
    killmailId: bigint,
    newInvolvedCharacters: Array<{
      character_id: bigint;
      role: 'attacker' | 'victim';
    }>,
    tx: any,
    correlationId: string
  ): Promise<void> {
    try {
      // Get tracked characters in a single query
      const trackedCharacterIds = new Set(
        (await tx.character.findMany({
          where: { 
            eveId: { 
              in: newInvolvedCharacters.map((c: any) => c.character_id) 
            } 
          },
          select: { eveId: true },
        })).map((c: Character) => c.eveId)
      );

      // Filter to only tracked characters
      const trackedInvolvedCharacters = newInvolvedCharacters.filter(c => 
        trackedCharacterIds.has(c.character_id)
      );

      // Get existing relationships
      const existingRelationships = await tx.killCharacter.findMany({
        where: { killmail_id: killmailId },
      });

      // Create sets for comparison
      const existingSet = new Set(
        existingRelationships.map((r: KillCharacter) => `${r.characterId}-${r.role}`)
      );
      const newSet = new Set(
        trackedInvolvedCharacters.map((c: any) => `${c.character_id}-${c.role}`)
      );

      // Find relationships to delete
      const toDelete = existingRelationships.filter((r: KillCharacter) => 
        !newSet.has(`${r.characterId}-${r.role}`)
      );

      // Find relationships to create
      const toCreate = trackedInvolvedCharacters.filter(c => 
        !existingSet.has(`${c.character_id}-${c.role}`)
      );

      // Perform deletions
      if (toDelete.length > 0) {
        await tx.killCharacter.deleteMany({
          where: {
            OR: toDelete.map((r: KillCharacter) => ({
              AND: [
                { killmailId: r.killmailId },
                { characterId: r.characterId },
                { role: r.role }
              ]
            }))
          },
        });
        logger.debug(`Deleted ${toDelete.length} character relationships for killmail ${killmailId}`, { correlationId });
      }

      // Perform batch creation
      if (toCreate.length > 0) {
        await tx.killCharacter.createMany({
          data: toCreate.map(c => ({
            killmail_id: killmailId,
            character_id: c.character_id,
            role: c.role,
          })),
          skipDuplicates: true,
        });
        logger.debug(`Created ${toCreate.length} character relationships for killmail ${killmailId}`, { correlationId });
      }
    } catch (error) {
      throw errorHandler.handleError(
        error,
        {
          operation: 'syncCharacterRelationships',
          correlationId,
          metadata: {
            killmailId: killmailId.toString(),
            entityType: 'kill_character',
          },
        }
      );
    }
  }

  /**
   * Create loss fact (no optimization needed - already efficient)
   */
  private async createLossFact(
    killFact: any,
    victim: any,
    attackers: any[],
    tx: any,
    correlationId: string
  ): Promise<void> {
    try {
      if (victim.character_id) {
        const isTracked = await tx.character.findUnique({
          where: { eveId: victim.character_id },
          select: { eveId: true },
        });

        if (isTracked) {
          await tx.lossFact.upsert({
            where: { killmail_id: killFact.killmail_id },
            update: {
              character_id: victim.character_id,
              kill_time: killFact.kill_time,
              ship_type_id: victim.ship_type_id,
              system_id: killFact.system_id,
              labels: killFact.labels,
              total_value: killFact.total_value,
              points: killFact.points,
              attacker_count: attackers.length,
              final_blow_attacker_id: attackers.find(a => a.final_blow)?.character_id ?? null,
            },
            create: {
              killmail_id: killFact.killmail_id,
              character_id: victim.character_id,
              kill_time: killFact.kill_time,
              ship_type_id: victim.ship_type_id,
              system_id: killFact.system_id,
              labels: killFact.labels,
              total_value: killFact.total_value,
              points: killFact.points,
              attacker_count: attackers.length,
              final_blow_attacker_id: attackers.find(a => a.final_blow)?.character_id ?? null,
            },
          });
        }
      }
    } catch (error) {
      throw errorHandler.handleError(
        error,
        {
          operation: 'createLossFact',
          correlationId,
          metadata: {
            killmailId: killFact.killmail_id.toString(),
            entityType: 'loss_fact',
          },
        }
      );
    }
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
        count: r._count.shipTypeId || 0,
      }));
    } catch (error) {
      logger.error('Failed to get top ship types used', error);
      throw new DatabaseError(
        'Failed to get top ship types used',
        'query',
        'kill_attacker',
        { metadata: { characterIds: characterIds.map(id => id.toString()), startDate, endDate, limit } },
        error as Error
      );
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

      return result.map((r: any) => ({
        shipTypeId: r.shipTypeId,
        count: r._count?.shipTypeId || 0,
      }));
    } catch (error) {
      logger.error('Failed to get top ship types destroyed', error);
      throw new DatabaseError(
        'Failed to get top ship types destroyed',
        'query',
        'kill_victim',
        { metadata: { characterIds: characterIds.map(id => id.toString()), startDate, endDate, limit } },
        error as Error
      );
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
      
      const result = await this.prisma.$queryRaw<Array<{ time: Date; count: bigint }>>`
        SELECT 
          date_trunc(${groupBy}, kf.kill_time) as time,
          COUNT(DISTINCT kf.killmail_id)::bigint as count
        FROM kill_fact kf
        INNER JOIN kill_character kc ON kc.killmail_id = kf.killmail_id
        WHERE kc.character_id = ANY(${characterIds})
          AND kc.role = 'attacker'
          AND kf.kill_time >= ${startDate}
          AND kf.kill_time <= ${endDate}
        GROUP BY date_trunc(${groupBy}, kf.kill_time)
        ORDER BY time ASC
      `;

      return result.map(r => ({
        time: r.time,
        count: Number(r.count),
      }));
    } catch (error) {
      logger.error('Failed to get kills grouped by time', error);
      throw new DatabaseError(
        'Failed to get kills grouped by time',
        'query',
        'kill_fact',
        { metadata: { characterIds: characterIds.map(id => id.toString()), startDate, endDate, groupBy } },
        error as Error
      );
    }
  }
}