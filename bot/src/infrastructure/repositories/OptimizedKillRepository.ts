import { PrismaClient } from '@prisma/client';
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
      throw errorHandler.handleDatabaseError(
        error,
        'transaction',
        'kill_fact',
        involvedCharacters[0]?.character_id?.toString(),
        {
          correlationId,
          operation: 'ingestKillmail.optimized',
          metadata: {
            killmailId: killFact.killmail_id.toString(),
            characterCount: involvedCharacters.length,
            attackerCount: attackers.length,
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
      throw errorHandler.handleDatabaseError(
        error,
        'upsert',
        'kill_fact',
        killFact.killmail_id.toString(),
        {
          correlationId,
          operation: 'upsertKillFacts',
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
      throw errorHandler.handleDatabaseError(
        error,
        'upsert',
        'kill_victim',
        killmailId.toString(),
        {
          correlationId,
          operation: 'upsertVictimData',
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
        killmail_id: killmailId,
        character_id: attacker.character_id ?? null,
        corporation_id: attacker.corporation_id ?? null,
        alliance_id: attacker.alliance_id ?? null,
        damage_done: attacker.damage_done,
        final_blow: attacker.final_blow,
        security_status: attacker.security_status ?? null,
        ship_type_id: attacker.ship_type_id ?? null,
        weapon_type_id: attacker.weapon_type_id ?? null,
        // Use index as unique identifier for this killmail
        temp_index: index,
      }));

      // Find attackers to delete (exist in DB but not in new data)
      const existingIds = new Set(existingAttackers.map(a => a.id));
      const attackersToDelete = existingAttackers.filter((existing, index) => {
        // Compare with new data at same index, or mark for deletion if index doesn't exist
        const newAttacker = newAttackerData[index];
        return !newAttacker || !this.attackersEqual(existing, newAttacker);
      });

      // Find attackers to create/update
      const attackersToUpsert = newAttackerData.filter((newAttacker, index) => {
        const existing = existingAttackers[index];
        return !existing || !this.attackersEqual(existing, newAttacker);
      });

      // Perform deletions if any attackers were removed or changed
      if (attackersToDelete.length > 0) {
        await tx.killAttacker.deleteMany({
          where: {
            id: { in: attackersToDelete.map(a => a.id) },
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
      throw errorHandler.handleDatabaseError(
        error,
        'sync',
        'kill_attacker',
        killmailId.toString(),
        {
          correlationId,
          operation: 'syncAttackerData',
        }
      );
    }
  }

  /**
   * Compare two attackers for equality
   */
  private attackersEqual(existing: any, newAttacker: any): boolean {
    return (
      existing.character_id === newAttacker.character_id &&
      existing.corporation_id === newAttacker.corporation_id &&
      existing.alliance_id === newAttacker.alliance_id &&
      existing.damage_done === newAttacker.damage_done &&
      existing.final_blow === newAttacker.final_blow &&
      existing.security_status === newAttacker.security_status &&
      existing.ship_type_id === newAttacker.ship_type_id &&
      existing.weapon_type_id === newAttacker.weapon_type_id
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
              in: newInvolvedCharacters.map(c => c.character_id) 
            } 
          },
          select: { eveId: true },
        })).map(c => c.eveId)
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
        existingRelationships.map(r => `${r.character_id}-${r.role}`)
      );
      const newSet = new Set(
        trackedInvolvedCharacters.map(c => `${c.character_id}-${c.role}`)
      );

      // Find relationships to delete
      const toDelete = existingRelationships.filter(r => 
        !newSet.has(`${r.character_id}-${r.role}`)
      );

      // Find relationships to create
      const toCreate = trackedInvolvedCharacters.filter(c => 
        !existingSet.has(`${c.character_id}-${c.role}`)
      );

      // Perform deletions
      if (toDelete.length > 0) {
        await tx.killCharacter.deleteMany({
          where: {
            id: { in: toDelete.map(r => r.id) },
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
      throw errorHandler.handleDatabaseError(
        error,
        'sync',
        'kill_character',
        killmailId.toString(),
        {
          correlationId,
          operation: 'syncCharacterRelationships',
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
      throw errorHandler.handleDatabaseError(
        error,
        'upsert',
        'loss_fact',
        killFact.killmail_id.toString(),
        {
          correlationId,
          operation: 'createLossFact',
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
      const result = await this.prisma.kill_attacker.groupBy({
        by: ['ship_type_id'],
        where: {
          character_id: { in: characterIds },
          ship_type_id: { not: null },
          kill: {
            kill_time: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        _count: {
          ship_type_id: true,
        },
        orderBy: {
          _count: {
            ship_type_id: 'desc',
          },
        },
        take: limit,
      });

      return result.map(r => ({
        shipTypeId: r.ship_type_id!,
        count: r._count.ship_type_id,
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
      const result = await this.prisma.kill_victim.groupBy({
        by: ['ship_type_id'],
        where: {
          kill: {
            kill_time: {
              gte: startDate,
              lte: endDate,
            },
            attackers: {
              some: {
                character_id: { in: characterIds },
              },
            },
          },
        },
        _count: {
          ship_type_id: true,
        },
        orderBy: {
          _count: {
            ship_type_id: 'desc',
          },
        },
        take: limit,
      });

      return result.map(r => ({
        shipTypeId: r.ship_type_id,
        count: r._count.ship_type_id,
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
      throw new DatabaseError('QUERY_FAILED', 'Failed to get kills grouped by time', {
        cause: error,
        context: { characterIds: characterIds.map(id => id.toString()), startDate, endDate, groupBy }
      });
    }
  }
}