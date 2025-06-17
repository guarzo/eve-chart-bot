import { Character } from '../domain/character/Character';
import { CharacterGroup } from '../domain/character/CharacterGroup';
import { CharacterRepository } from '../infrastructure/repositories/CharacterRepository';
import { logger } from '../lib/logger';
import { ESIService } from './ESIService';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from '../shared/errors/ErrorHandler';
import { ValidationError, ExternalServiceError } from '../shared/errors';

/**
 * Service for handling character-related business logic
 */
export class CharacterService {
  private characterRepository: CharacterRepository;
  private esiService: ESIService;

  constructor() {
    const prisma = new PrismaClient();
    this.characterRepository = new CharacterRepository(prisma);
    this.esiService = new ESIService();
  }

  /**
   * Get a character by ID
   */
  async getCharacter(characterId: string): Promise<Character | null> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!characterId || typeof characterId !== 'string') {
        throw ValidationError.fieldRequired('characterId', {
          correlationId,
          operation: 'character.getCharacter',
        });
      }

      logger.debug('Getting character by ID', {
        correlationId,
        characterId,
      });

      const result = await errorHandler.withRetry(
        async () => {
          return await this.characterRepository.getCharacter(BigInt(characterId));
        },
        3,
        1000,
        {
          correlationId,
          operation: 'character.service.getCharacter',
          metadata: { characterId },
        }
      );

      logger.debug('Successfully retrieved character', {
        correlationId,
        characterId,
        found: !!result,
        characterName: result?.name || 'N/A',
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'getCharacter',
        metadata: { characterId, entityType: 'character' },
      });
    }
  }

  /**
   * Get all characters
   */
  async getAllCharacters(): Promise<Character[]> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      logger.debug('Getting all characters', {
        correlationId,
      });

      const result = await errorHandler.withRetry(
        async () => {
          return await this.characterRepository.getAllCharacters();
        },
        3,
        1000,
        {
          correlationId,
          operation: 'character.service.getAllCharacters',
        }
      );

      logger.debug('Successfully retrieved all characters', {
        correlationId,
        count: result.length,
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'getAllCharacters',
      });
    }
  }

  /**
   * Get characters by group ID
   */
  async getCharactersByGroup(groupId: string): Promise<Character[]> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!groupId || typeof groupId !== 'string') {
        throw ValidationError.fieldRequired('groupId', {
          correlationId,
          operation: 'character.getCharactersByGroup',
        });
      }

      logger.debug('Getting characters by group ID', {
        correlationId,
        groupId,
      });

      const result = await errorHandler.withRetry(
        async () => {
          return await this.characterRepository.getCharactersByGroup(groupId);
        },
        3,
        1000,
        {
          correlationId,
          operation: 'character.service.getCharactersByGroup',
          metadata: { groupId },
        }
      );

      logger.debug('Successfully retrieved characters by group', {
        correlationId,
        groupId,
        count: result.length,
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'getCharactersByGroup',
        metadata: { groupId, entityType: 'character' },
      });
    }
  }

  /**
   * Get a character group by ID
   */
  async getCharacterGroup(groupId: string): Promise<CharacterGroup | null> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!groupId || typeof groupId !== 'string') {
        throw ValidationError.fieldRequired('groupId', {
          correlationId,
          operation: 'character.getCharacterGroup',
        });
      }

      logger.debug('Getting character group by ID', {
        correlationId,
        groupId,
      });

      const result = await errorHandler.withRetry(
        async () => {
          return await this.characterRepository.getCharacterGroup(groupId);
        },
        3,
        1000,
        {
          correlationId,
          operation: 'character.service.getCharacterGroup',
          metadata: { groupId },
        }
      );

      logger.debug('Successfully retrieved character group', {
        correlationId,
        groupId,
        found: !!result,
        groupName: result?.name || 'N/A',
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'getCharacterGroup',
        metadata: { groupId, entityType: 'characterGroup' },
      });
    }
  }

  /**
   * Get all character groups
   */
  async getAllCharacterGroups(): Promise<CharacterGroup[]> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      logger.debug('Getting all character groups', {
        correlationId,
      });

      const result = await errorHandler.withRetry(
        async () => {
          return await this.characterRepository.getAllCharacterGroups();
        },
        3,
        1000,
        {
          correlationId,
          operation: 'character.service.getAllCharacterGroups',
        }
      );

      logger.debug('Successfully retrieved all character groups', {
        correlationId,
        count: result.length,
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'getAllCharacterGroups',
        metadata: { entityType: 'characterGroup' },
      });
    }
  }

  /**
   * Save a character
   */
  async saveCharacter(character: Character): Promise<Character> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!character) {
        throw ValidationError.fieldRequired('character', {
          correlationId,
          operation: 'character.saveCharacter',
        });
      }

      if (!character.eveId) {
        throw ValidationError.fieldRequired('character.eveId', {
          correlationId,
          operation: 'character.saveCharacter',
        });
      }

      logger.debug('Saving character', {
        correlationId,
        characterId: character.eveId,
        characterName: character.name,
      });

      const result = await errorHandler.withRetry(
        async () => {
          return await this.characterRepository.upsertCharacter({
            eveId: BigInt(character.eveId),
            name: character.name,
            corporationId: character.corporationId,
            corporationTicker: character.corporationTicker,
            allianceId: character.allianceId,
            allianceTicker: character.allianceTicker,
            characterGroupId: character.characterGroupId,
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'character.service.saveCharacter',
          metadata: { characterId: character.eveId },
        }
      );

      logger.debug('Successfully saved character', {
        correlationId,
        characterId: character.eveId,
        characterName: result.name,
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'saveCharacter',
        metadata: { characterId: character?.eveId, entityType: 'character' },
      });
    }
  }

  /**
   * Save a character group
   */
  async saveCharacterGroup(group: CharacterGroup): Promise<CharacterGroup> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!group) {
        throw ValidationError.fieldRequired('group', {
          correlationId,
          operation: 'character.saveCharacterGroup',
        });
      }

      if (!group.map_name) {
        throw ValidationError.fieldRequired('group.map_name', {
          correlationId,
          operation: 'character.saveCharacterGroup',
        });
      }

      logger.debug('Saving character group', {
        correlationId,
        mapName: group.map_name,
        mainCharacterId: group.mainCharacterId,
      });

      const result = await errorHandler.withRetry(
        async () => {
          return await this.characterRepository.createCharacterGroup({
            mapName: group.map_name,
            mainCharacterId: group.mainCharacterId ? BigInt(group.mainCharacterId) : null,
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'character.service.saveCharacterGroup',
          metadata: {
            mapName: group.map_name,
            mainCharacterId: group.mainCharacterId,
          },
        }
      );

      logger.debug('Successfully saved character group', {
        correlationId,
        groupId: result.id,
        mapName: result.map_name,
      });

      return result;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'saveCharacterGroup',
        metadata: { mapName: group?.map_name, entityType: 'characterGroup' },
      });
    }
  }

  /**
   * Delete a character
   */
  async deleteCharacter(characterId: string): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!characterId || typeof characterId !== 'string') {
        throw ValidationError.fieldRequired('characterId', {
          correlationId,
          operation: 'character.deleteCharacter',
        });
      }

      logger.debug('Deleting character', {
        correlationId,
        characterId,
      });

      await errorHandler.withRetry(
        async () => {
          await this.characterRepository.deleteCharacter(BigInt(characterId));
        },
        3,
        1000,
        {
          correlationId,
          operation: 'character.service.deleteCharacter',
          metadata: { characterId },
        }
      );

      logger.debug('Successfully deleted character', {
        correlationId,
        characterId,
      });
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'deleteCharacter',
        metadata: { characterId, entityType: 'character' },
      });
    }
  }

  /**
   * Delete a character group
   */
  async deleteCharacterGroup(groupId: string): Promise<void> {
    // This method needs to be implemented in CharacterRepository
    // TODO: Implement using groupId parameter
    void groupId; // Suppress unused variable warning
    throw new Error('deleteCharacterGroup not implemented');
  }

  /**
   * Set a character as the main character in a group
   */
  async setMainCharacter(characterId: string): Promise<CharacterGroup> {
    // This method needs to be implemented in CharacterRepository
    // TODO: Implement using characterId parameter
    void characterId; // Suppress unused variable warning
    throw new Error('setMainCharacter not implemented');
  }

  /**
   * Remove a character from a group
   */
  async removeFromGroup(characterId: string): Promise<Character> {
    // This method needs to be implemented in CharacterRepository
    // TODO: Implement using characterId parameter
    void characterId; // Suppress unused variable warning
    throw new Error('removeFromGroup not implemented');
  }

  /**
   * Sync character information from Map API data
   */
  async syncCharacter(
    characterId: string,
    mapData: {
      corporationTicker: string;
      allianceTicker?: string | null;
      corporationId: number;
    }
  ): Promise<Character> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!characterId || typeof characterId !== 'string') {
        throw ValidationError.fieldRequired('characterId', {
          correlationId,
          operation: 'character.syncCharacter',
        });
      }

      if (!mapData) {
        throw ValidationError.fieldRequired('mapData', {
          correlationId,
          operation: 'character.syncCharacter',
          metadata: { characterId },
        });
      }

      if (!mapData.corporationTicker) {
        throw ValidationError.fieldRequired('mapData.corporationTicker', {
          correlationId,
          operation: 'character.syncCharacter',
          metadata: { characterId },
        });
      }

      logger.info(`Syncing character ${characterId} from Map API data...`, {
        correlationId,
        characterId,
        corporationId: mapData.corporationId,
        corporationTicker: mapData.corporationTicker,
      });

      // Create or update character using only map data
      const character = new Character({
        eveId: characterId,
        name: characterId, // We don't need the name since it can't change
        allianceTicker: mapData.allianceTicker ?? undefined,
        corporationTicker: mapData.corporationTicker,
        corporationId: mapData.corporationId,
      });

      logger.debug(`Created character object:`, {
        correlationId,
        character: {
          eveId: character.eveId,
          name: character.name,
          corporationId: character.corporationId,
          corporationTicker: character.corporationTicker,
        },
      });

      const saved = await this.saveCharacter(character);
      logger.info(`Successfully synced character ${characterId}`, {
        correlationId,
        characterId,
        savedName: saved.name,
      });

      return saved;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'syncCharacter',
        metadata: {
          characterId,
          corporationId: mapData?.corporationId,
        },
      });
    }
  }

  /**
   * Sync multiple characters from ESI
   */
  async syncCharacters(characterIds: string[]): Promise<Character[]> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input parameters
      if (!characterIds || !Array.isArray(characterIds)) {
        throw ValidationError.fieldRequired('characterIds', {
          correlationId,
          operation: 'character.syncCharacters',
        });
      }

      if (characterIds.length === 0) {
        logger.debug('Empty characterIds array provided, returning empty results', {
          correlationId,
        });
        return [];
      }

      logger.info(`Syncing ${characterIds.length} characters from ESI`, {
        correlationId,
        characterCount: characterIds.length,
      });

      const results: Character[] = [];
      const errors: Array<{ characterId: string; error: any }> = [];

      for (const characterId of characterIds) {
        try {
          logger.debug(`Syncing character ${characterId}`, {
            correlationId,
            characterId,
          });

          // Get character data from ESI
          const esiData = await this.esiService.getCharacter(parseInt(characterId, 10));
          if (!esiData) {
            throw new ExternalServiceError(
              'ESI',
              `No ESI data found for character ${characterId}`,
              undefined,
              undefined,
              {
                correlationId,
                operation: 'syncCharacters.getCharacter',
                metadata: { characterId },
              }
            );
          }

          const character = await this.syncCharacter(characterId, {
            corporationTicker: esiData.corporation_ticker,
            allianceTicker: esiData.alliance_ticker,
            corporationId: esiData.corporation_id,
          });
          results.push(character);

          logger.debug(`Successfully synced character ${characterId}`, {
            correlationId,
            characterId,
            characterName: character.name,
          });
        } catch (error) {
          errors.push({ characterId, error });
          logger.error(`Failed to sync character ${characterId}`, {
            correlationId,
            characterId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      }

      if (errors.length > 0) {
        logger.warn(`Completed character sync with ${errors.length} errors out of ${characterIds.length} characters`, {
          correlationId,
          totalCharacters: characterIds.length,
          successCount: results.length,
          errorCount: errors.length,
        });
      } else {
        logger.info(`Successfully synced all ${characterIds.length} characters`, {
          correlationId,
          characterCount: characterIds.length,
        });
      }

      return results;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'syncCharacters',
        metadata: { characterCount: characterIds?.length },
      });
    }
  }
}
