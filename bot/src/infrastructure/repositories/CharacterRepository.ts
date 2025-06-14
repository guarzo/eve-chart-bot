import { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger';
import { Character } from '../../domain/character/Character';
import { CharacterGroup } from '../../domain/character/CharacterGroup';
import { PrismaMapper } from '../mapper/PrismaMapper';

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
    try {
      const characters = await this.prisma.character.findMany({
        orderBy: { name: 'asc' },
      });
      return PrismaMapper.mapArray(characters, Character);
    } catch (error) {
      logger.error('Failed to get all characters', error);
      throw error;
    }
  }

  /**
   * Get a character by EVE ID
   */
  async getCharacter(eveId: bigint): Promise<Character | null> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { eveId },
      });
      return character ? PrismaMapper.map(character, Character) : null;
    } catch (error) {
      logger.error(`Failed to get character ${eveId}`, error);
      throw error;
    }
  }

  /**
   * Get characters by group ID
   */
  async getCharactersByGroup(groupId: string): Promise<Character[]> {
    try {
      const characters = await this.prisma.character.findMany({
        where: { characterGroupId: groupId },
        orderBy: { name: 'asc' },
      });
      return PrismaMapper.mapArray(characters, Character);
    } catch (error) {
      logger.error(`Failed to get characters for group ${groupId}`, error);
      throw error;
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
    try {
      const result = await this.prisma.character.upsert({
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
      return PrismaMapper.map(result, Character);
    } catch (error) {
      logger.error(`Failed to upsert character ${character.eveId}`, error);
      throw error;
    }
  }

  /**
   * Remove a character from tracking
   */
  async deleteCharacter(eveId: bigint): Promise<void> {
    try {
      await this.prisma.character.delete({
        where: { eveId },
      });
      logger.info(`Deleted character ${eveId}`);
    } catch (error) {
      logger.error(`Failed to delete character ${eveId}`, error);
      throw error;
    }
  }

  /**
   * Get all character groups
   */
  async getAllCharacterGroups(): Promise<CharacterGroup[]> {
    try {
      const groups = await this.prisma.characterGroup.findMany({
        include: {
          characters: true,
          mainCharacter: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      return PrismaMapper.mapArray(groups, CharacterGroup);
    } catch (error) {
      logger.error('Failed to get character groups', error);
      throw error;
    }
  }

  /**
   * Get a character group by ID
   */
  async getCharacterGroup(id: string): Promise<CharacterGroup | null> {
    try {
      const group = await this.prisma.characterGroup.findUnique({
        where: { id },
        include: {
          characters: true,
          mainCharacter: true,
        },
      });
      return group ? PrismaMapper.map(group, CharacterGroup) : null;
    } catch (error) {
      logger.error(`Failed to get character group ${id}`, error);
      throw error;
    }
  }

  /**
   * Create a character group
   */
  async createCharacterGroup(data: { map_name: string; mainCharacterId?: bigint | null }): Promise<CharacterGroup> {
    try {
      const group = await this.prisma.characterGroup.create({
        data,
        include: {
          characters: true,
          mainCharacter: true,
        },
      });
      return PrismaMapper.map(group, CharacterGroup);
    } catch (error) {
      logger.error('Failed to create character group', error);
      throw error;
    }
  }

  /**
   * Update characters in a group (for WebSocket subscription updates)
   */
  async updateCharacterGroup(groupId: string, characterIds: bigint[]): Promise<void> {
    try {
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

      logger.info(`Updated character group ${groupId} with ${characterIds.length} characters`);
    } catch (error) {
      logger.error(`Failed to update character group ${groupId}`, error);
      throw error;
    }
  }

  /**
   * Get character IDs for WebSocket subscription
   */
  async getTrackedCharacterIds(): Promise<bigint[]> {
    try {
      const characters = await this.prisma.character.findMany({
        select: { eveId: true },
      });
      return characters.map(c => c.eveId);
    } catch (error) {
      logger.error('Failed to get tracked character IDs', error);
      throw error;
    }
  }
}
