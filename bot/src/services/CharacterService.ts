import { Character } from "../domain/character/Character";
import { CharacterGroup } from "../domain/character/CharacterGroup";
import { CharacterRepository } from "../infrastructure/repositories/CharacterRepository";
import { logger } from "../lib/logger";
import { ESIService } from "./ESIService";
import { PrismaClient } from "@prisma/client";

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
    return this.characterRepository.getCharacter(BigInt(characterId));
  }

  /**
   * Get all characters
   */
  async getAllCharacters(): Promise<Character[]> {
    return this.characterRepository.getAllCharacters();
  }

  /**
   * Get characters by group ID
   */
  async getCharactersByGroup(groupId: string): Promise<Character[]> {
    return this.characterRepository.getCharactersByGroup(groupId);
  }

  /**
   * Get a character group by ID
   */
  async getCharacterGroup(groupId: string): Promise<CharacterGroup | null> {
    return this.characterRepository.getCharacterGroup(groupId);
  }

  /**
   * Get all character groups
   */
  async getAllCharacterGroups(): Promise<CharacterGroup[]> {
    return this.characterRepository.getAllCharacterGroups();
  }

  /**
   * Save a character
   */
  async saveCharacter(character: Character): Promise<Character> {
    return this.characterRepository.upsertCharacter({
      eveId: BigInt(character.eveId),
      name: character.name,
      corporationId: character.corporationId,
      corporationTicker: character.corporationTicker,
      allianceId: character.allianceId,
      allianceTicker: character.allianceTicker,
      characterGroupId: character.characterGroupId,
    });
  }

  /**
   * Save a character group
   */
  async saveCharacterGroup(group: CharacterGroup): Promise<CharacterGroup> {
    return this.characterRepository.createCharacterGroup({
      map_name: group.map_name,
      mainCharacterId: group.mainCharacterId ? BigInt(group.mainCharacterId) : null,
    });
  }

  /**
   * Delete a character
   */
  async deleteCharacter(characterId: string): Promise<void> {
    await this.characterRepository.deleteCharacter(BigInt(characterId));
  }

  /**
   * Delete a character group
   */
  async deleteCharacterGroup(_groupId: string): Promise<void> {
    // This method needs to be implemented in CharacterRepository
    throw new Error('deleteCharacterGroup not implemented');
  }

  /**
   * Set a character as the main character in a group
   */
  async setMainCharacter(_characterId: string): Promise<CharacterGroup> {
    // This method needs to be implemented in CharacterRepository
    throw new Error('setMainCharacter not implemented');
  }

  /**
   * Remove a character from a group
   */
  async removeFromGroup(_characterId: string): Promise<Character> {
    // This method needs to be implemented in CharacterRepository
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
    try {
      logger.info(`Syncing character ${characterId} from Map API data...`);

      // Create or update character using only map data
      const character = new Character({
        eveId: characterId,
        name: characterId, // We don't need the name since it can't change
        allianceTicker: mapData.allianceTicker || undefined,
        corporationTicker: mapData.corporationTicker,
        corporationId: mapData.corporationId,
      });

      logger.debug(`Created character object:`, character);

      const saved = await this.saveCharacter(character);
      logger.info(`Successfully synced character ${characterId}`);
      return saved;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(
        {
          error,
          characterId,
          errorMessage,
          errorStack,
        },
        `Failed to sync character ${characterId}: ${errorMessage}`
      );
      throw error;
    }
  }

  /**
   * Sync multiple characters from ESI
   */
  async syncCharacters(characterIds: string[]): Promise<Character[]> {
    const results: Character[] = [];
    const errors: Array<{ characterId: string; error: any }> = [];

    for (const characterId of characterIds) {
      try {
        // Get character data from ESI
        const esiData = await this.esiService.getCharacter(
          parseInt(characterId, 10)
        );
        if (!esiData) {
          throw new Error(`No ESI data found for character ${characterId}`);
        }

        const character = await this.syncCharacter(characterId, {
          corporationTicker: esiData.corporation_ticker,
          allianceTicker: esiData.alliance_ticker,
          corporationId: esiData.corporation_id,
        });
        results.push(character);
      } catch (error) {
        errors.push({ characterId, error });
        logger.error(`Failed to sync character ${characterId}:`, error);
      }
    }

    if (errors.length > 0) {
      logger.warn(
        `Completed character sync with ${errors.length} errors out of ${characterIds.length} characters`
      );
    } else {
      logger.info(`Successfully synced all ${characterIds.length} characters`);
    }

    return results;
  }
}
