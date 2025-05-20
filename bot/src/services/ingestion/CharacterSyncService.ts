import { ESIService } from "../ESIService";
import { RetryService } from "./RetryService";
import { logger } from "../../lib/logger";
import { Character } from "../../domain/character/Character";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";
import { MapClient } from "../../lib/api/MapClient";

export class CharacterSyncService {
  private readonly characterRepository: CharacterRepository;
  private readonly esiService: ESIService;
  private readonly retryService: RetryService;
  private readonly map: MapClient;

  constructor(
    mapApiUrl: string,
    mapApiKey: string,
    maxRetries: number = 3,
    retryDelay: number = 5000
  ) {
    this.characterRepository = new CharacterRepository();
    this.esiService = new ESIService();
    this.retryService = new RetryService(maxRetries, retryDelay);
    this.map = new MapClient(mapApiUrl, mapApiKey);
  }

  public async syncUserCharacters(mapName: string): Promise<void> {
    try {
      // Get all characters from map API
      const mapData = await this.retryService.retryOperation(
        () => this.map.getUserCharacters(mapName),
        `Fetching character data for map ${mapName}`,
        3,
        5000,
        30000
      );

      if (!mapData?.data || !Array.isArray(mapData.data)) {
        logger.warn(`No valid character data available for map ${mapName}`);
        return;
      }

      // Extract unique characters from the map data
      const uniqueCharacters = new Map();
      for (const user of mapData.data) {
        for (const character of user.characters) {
          if (character.eve_id) {
            uniqueCharacters.set(character.eve_id, character);
          }
        }
      }

      logger.info(
        `Found ${uniqueCharacters.size} unique characters to sync for map ${mapName}`
      );

      // Sync each character
      for (const [eveId, characterData] of uniqueCharacters) {
        await this.syncCharacter(eveId.toString(), characterData);
      }

      logger.info(`Successfully synced all characters for map ${mapName}`);
    } catch (error: any) {
      logger.error(
        `Error syncing user characters for map ${mapName}: ${error.message}`
      );
      throw error;
    }
  }

  private async syncCharacter(
    eveId: string,
    mapCharacterData: any
  ): Promise<void> {
    try {
      // Check if character already exists
      const existingCharacter = await this.characterRepository.getCharacter(
        eveId
      );

      let characterName: string;
      if (existingCharacter) {
        // Use existing name for updates
        characterName = existingCharacter.name;
      } else {
        // Get character name from ESI only for new characters
        const esiData = await this.retryService.retryOperation(
          () => this.esiService.getCharacter(parseInt(eveId)),
          `Fetching character name for ${eveId}`,
          3,
          5000,
          30000
        );

        if (!esiData) {
          logger.warn(`No ESI data available for character ${eveId}`);
          return;
        }
        characterName = esiData.name;
      }

      // Create character instance using domain entity with data from both sources
      const character = new Character({
        eveId,
        name: characterName,
        corporationId: mapCharacterData.corporation_id,
        corporationTicker: mapCharacterData.corporation_ticker || "",
        allianceId: mapCharacterData.alliance_id,
        allianceTicker: mapCharacterData.alliance_ticker || "",
        createdAt: existingCharacter?.createdAt || new Date(),
        updatedAt: new Date(),
      });

      // Save character using repository
      await this.characterRepository.saveCharacter(character);
      logger.info(`Successfully synced character ${eveId}`);
    } catch (error: any) {
      logger.error(`Error syncing character ${eveId}: ${error.message}`);
      throw error;
    }
  }

  public async close(): Promise<void> {
    // No resources to clean up at the moment
  }
}
