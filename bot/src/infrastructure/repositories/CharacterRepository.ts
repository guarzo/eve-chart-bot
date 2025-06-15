import { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger';
import { Character } from '../../domain/character/Character';
import { CharacterGroup } from '../../domain/character/CharacterGroup';
import { PrismaMapper } from '../mapper/PrismaMapper';
import { errorHandler, DatabaseError } from '../../shared/errors';

/**
 * Simplified Character Repository for WebSocket-based system
 * Removed backfill-related functionality
 */
export class CharacterRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all tracked characters
   */
  async getAllCharacters(): Promise<Character[]> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      const characters = await errorHandler.withRetry(
        async () => {
          return await this.prisma.character.findMany({
            orderBy: { name: 'asc' },
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'db.getAllCharacters',
        }
      );
      
      logger.debug('Successfully retrieved all characters', {
        correlationId,
        characterCount: characters.length,
      });
      
      return PrismaMapper.mapArray(characters, Character);
    } catch (error) {
      throw errorHandler.handleDatabaseError(
        error,
        'read',
        'character',
        undefined,
        {
          correlationId,
          operation: 'getAllCharacters',
        }
      );
    }
  }

  /**
   * Get a character by EVE ID
   */
  async getCharacter(eveId: bigint): Promise<Character | null> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      const character = await errorHandler.withRetry(
        async () => {
          return await this.prisma.character.findUnique({
            where: { eveId },
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'db.getCharacter',
          characterId: eveId.toString(),
        }
      );
      
      if (!character) {
        logger.debug('Character not found', {
          correlationId,
          eveId: eveId.toString(),
        });
        return null;
      }
      
      logger.debug('Successfully retrieved character', {
        correlationId,
        eveId: eveId.toString(),
        characterName: character.name,
      });
      
      return PrismaMapper.map(character, Character);
    } catch (error) {
      throw errorHandler.handleDatabaseError(
        error,
        'read',
        'character',
        eveId.toString(),
        {
          correlationId,
          operation: 'getCharacter',
          metadata: { eveId: eveId.toString() },
        }
      );
    }
  }

  /**
   * Get characters by group ID
   */
  async getCharactersByGroup(groupId: string): Promise<Character[]> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      const characters = await errorHandler.withRetry(
        async () => {
          return await this.prisma.character.findMany({
            where: { characterGroupId: groupId },
            orderBy: { name: 'asc' },
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'db.getCharactersByGroup',
          metadata: { groupId },
        }
      );
      
      logger.debug('Successfully retrieved characters by group', {
        correlationId,
        groupId,
        characterCount: characters.length,
      });
      
      return PrismaMapper.mapArray(characters, Character);
    } catch (error) {
      throw errorHandler.handleDatabaseError(
        error,
        'read',
        'character',
        undefined,
        {
          correlationId,
          operation: 'getCharactersByGroup',
          metadata: { groupId },
        }
      );
    }
  }

  /**
   * Create or update a character
   */
  async upsertCharacter(character: {
    eveId: bigint;
    name: string;
    corporationId: number;
    corporationTicker: string;
    allianceId?: number | null;
    allianceTicker?: string | null;
    characterGroupId?: string | null;
  }): Promise<Character> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      const result = await errorHandler.withRetry(
        async () => {
          return await this.prisma.character.upsert({
            where: { eveId: character.eveId },
            update: {
              name: character.name,
              corporationId: character.corporationId,
              corporationTicker: character.corporationTicker,
              allianceId: character.allianceId,
              allianceTicker: character.allianceTicker,
              characterGroupId: character.characterGroupId,
            },
            create: character,
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'db.upsertCharacter',
          metadata: { eveId: character.eveId.toString(), name: character.name },
        }
      );
      
      logger.debug('Successfully upserted character', {
        correlationId,
        eveId: character.eveId.toString(),
        name: character.name,
      });
      
      return PrismaMapper.map(result, Character);
    } catch (error) {
      throw errorHandler.handleDatabaseError(
        error,
        'upsert',
        'character',
        character.eveId.toString(),
        {
          correlationId,
          operation: 'upsertCharacter',
          metadata: { eveId: character.eveId.toString(), name: character.name },
        }
      );
    }
  }

  /**
   * Remove a character from tracking
   */
  async deleteCharacter(eveId: bigint): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      await errorHandler.withRetry(
        async () => {
          await this.prisma.character.delete({
            where: { eveId },
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'db.deleteCharacter',
          metadata: { eveId: eveId.toString() },
        }
      );
      
      logger.info('Successfully deleted character', {
        correlationId,
        eveId: eveId.toString(),
      });
    } catch (error) {
      throw errorHandler.handleDatabaseError(
        error,
        'delete',
        'character',
        eveId.toString(),
        {
          correlationId,
          operation: 'deleteCharacter',
          metadata: { eveId: eveId.toString() },
        }
      );
    }
  }

  /**
   * Get all character groups
   */
  async getAllCharacterGroups(): Promise<CharacterGroup[]> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      const groups = await errorHandler.withRetry(
        async () => {
          return await this.prisma.characterGroup.findMany({
            include: {
              characters: true,
              mainCharacter: true,
            },
            orderBy: { createdAt: 'asc' },
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'db.getAllCharacterGroups',
        }
      );
      
      logger.debug('Successfully retrieved all character groups', {
        correlationId,
        groupCount: groups.length,
      });
      
      return PrismaMapper.mapArray(groups, CharacterGroup);
    } catch (error) {
      throw errorHandler.handleDatabaseError(
        error,
        'read',
        'characterGroup',
        undefined,
        {
          correlationId,
          operation: 'getAllCharacterGroups',
        }
      );
    }
  }

  /**
   * Get a character group by ID
   */
  async getCharacterGroup(id: string): Promise<CharacterGroup | null> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      const group = await errorHandler.withRetry(
        async () => {
          return await this.prisma.characterGroup.findUnique({
            where: { id },
            include: {
              characters: true,
              mainCharacter: true,
            },
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'db.getCharacterGroup',
          metadata: { groupId: id },
        }
      );
      
      if (!group) {
        logger.debug('Character group not found', {
          correlationId,
          groupId: id,
        });
        return null;
      }
      
      logger.debug('Successfully retrieved character group', {
        correlationId,
        groupId: id,
        characterCount: group.characters?.length || 0,
      });
      
      return PrismaMapper.map(group, CharacterGroup);
    } catch (error) {
      throw errorHandler.handleDatabaseError(
        error,
        'read',
        'characterGroup',
        id,
        {
          correlationId,
          operation: 'getCharacterGroup',
          metadata: { groupId: id },
        }
      );
    }
  }

  /**
   * Create a character group
   */
  async createCharacterGroup(data: { mapName: string; mainCharacterId?: bigint | null }): Promise<CharacterGroup> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      const group = await errorHandler.withRetry(
        async () => {
          return await this.prisma.characterGroup.create({
            data: {
              mapName: data.mapName,
              mainCharacterId: data.mainCharacterId,
            },
            include: {
              characters: true,
              mainCharacter: true,
            },
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'db.createCharacterGroup',
          metadata: { mapName: data.mapName, mainCharacterId: data.mainCharacterId?.toString() },
        }
      );
      
      logger.info('Successfully created character group', {
        correlationId,
        groupId: group.id,
        mapName: data.mapName,
        mainCharacterId: data.mainCharacterId?.toString(),
      });
      
      return PrismaMapper.map(group, CharacterGroup);
    } catch (error) {
      throw errorHandler.handleDatabaseError(
        error,
        'create',
        'characterGroup',
        undefined,
        {
          correlationId,
          operation: 'createCharacterGroup',
          metadata: { mapName: data.mapName, mainCharacterId: data.mainCharacterId?.toString() },
        }
      );
    }
  }

  /**
   * Update characters in a group (for WebSocket subscription updates)
   */
  async updateCharacterGroup(groupId: string, characterIds: bigint[]): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      await errorHandler.withRetry(
        async () => {
          await this.prisma.$transaction(async tx => {
            // Remove all characters from this group
            await tx.character.updateMany({
              where: { characterGroupId: groupId },
              data: { characterGroupId: null },
            });

            // Add specified characters to the group
            if (characterIds.length > 0) {
              await tx.character.updateMany({
                where: { eveId: { in: characterIds } },
                data: { characterGroupId: groupId },
              });
            }
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'db.updateCharacterGroup',
          metadata: { groupId, characterCount: characterIds.length },
        }
      );

      logger.info('Successfully updated character group', {
        correlationId,
        groupId,
        characterCount: characterIds.length,
      });
    } catch (error) {
      throw errorHandler.handleDatabaseError(
        error,
        'update',
        'characterGroup',
        groupId,
        {
          correlationId,
          operation: 'updateCharacterGroup',
          metadata: { groupId, characterCount: characterIds.length },
        }
      );
    }
  }

  /**
   * Get character IDs for WebSocket subscription
   */
  async getTrackedCharacterIds(): Promise<bigint[]> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      const characters = await errorHandler.withRetry(
        async () => {
          return await this.prisma.character.findMany({
            select: { eveId: true },
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'db.getTrackedCharacterIds',
        }
      );
      
      logger.debug('Successfully retrieved tracked character IDs', {
        correlationId,
        characterCount: characters.length,
      });
      
      return characters.map(c => c.eveId);
    } catch (error) {
      throw errorHandler.handleDatabaseError(
        error,
        'read',
        'character',
        undefined,
        {
          correlationId,
          operation: 'getTrackedCharacterIds',
        }
      );
    }
  }
}
