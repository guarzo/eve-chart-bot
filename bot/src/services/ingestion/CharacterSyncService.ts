import { CharacterService } from "../CharacterService";
import { ESIService } from "../ESIService";
import { RetryService } from "./RetryService";
import { logger } from "../../lib/logger";
import { Character } from "../../domain/character/Character";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";

export class CharacterSyncService {
  private readonly characterService: CharacterService;
  private readonly characterRepository: CharacterRepository;
  private readonly esiService: ESIService;
  private readonly retryService: RetryService;

  constructor(maxRetries: number = 3, retryDelay: number = 5000) {
    this.characterService = new CharacterService();
    this.characterRepository = new CharacterRepository();
    this.esiService = new ESIService();
    this.retryService = new RetryService(maxRetries, retryDelay);
  }

  public async syncUserCharacters(mapName: string): Promise<void> {
    try {
      // Get all characters for the map using repository
      const characters = await this.characterRepository.getCharactersByMapName(
        mapName
      );
      logger.info(
        `Found ${characters.length} characters to sync for map ${mapName}`
      );

      // Sync each character
      for (const character of characters) {
        await this.syncCharacter(character.eveId);
      }

      logger.info(`Successfully synced all characters for map ${mapName}`);
    } catch (error: any) {
      logger.error(
        `Error syncing user characters for map ${mapName}: ${error.message}`
      );
      throw error;
    }
  }

  private async syncCharacter(eveId: string): Promise<void> {
    try {
      // Get character data from ESI
      const characterData = await this.retryService.retryOperation(
        () => this.esiService.getCharacter(parseInt(eveId)),
        `Fetching character data for ${eveId}`,
        3,
        5000,
        30000
      );

      if (!characterData) {
        logger.warn(`No character data available for ${eveId}`);
        return;
      }

      // Create character instance using domain entity
      const character = new Character({
        eveId,
        name: characterData.name,
        corporationId: characterData.corporation_id,
        corporationTicker: characterData.corporation_ticker || "",
        allianceId: characterData.alliance_id,
        allianceTicker: characterData.alliance_ticker || "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update character in database using service
      await this.characterService.saveCharacter(character);
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
