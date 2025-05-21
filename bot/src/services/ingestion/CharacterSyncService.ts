import { ESIService } from "../ESIService";
import { retryOperation } from "../../utils/retry";
import { logger } from "../../lib/logger";
import { Character } from "../../domain/character/Character";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";
import { MapClient } from "../../infrastructure/http/MapClient";

export class CharacterSyncService {
  private readonly characterRepository: CharacterRepository;
  private readonly esiService: ESIService;
  private readonly map: MapClient;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    mapApiUrl: string,
    mapApiKey: string,
    maxRetries: number = 3,
    retryDelay: number = 5000
  ) {
    this.characterRepository = new CharacterRepository();
    this.esiService = new ESIService();
    this.map = new MapClient(mapApiUrl, mapApiKey);
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Start the character sync service
   */
  public async start(): Promise<void> {
    logger.info("Starting character sync service...");

    const mapName = process.env.MAP_NAME;
    if (!mapName) {
      logger.warn(
        "MAP_NAME environment variable not set, skipping character sync"
      );
      return;
    }

    try {
      await this.syncUserCharacters(mapName);
      logger.info("Character sync service started successfully");
    } catch (error) {
      logger.error(`Error during character sync: ${error}`);
      throw error;
    }
  }

  public async syncUserCharacters(mapName: string): Promise<void> {
    try {
      // Get all characters from map API
      const mapData = await retryOperation(
        () => this.map.getUserCharacters(mapName),
        `Fetching character data for map ${mapName}`,
        {
          maxRetries: this.maxRetries,
          initialRetryDelay: this.retryDelay,
          timeout: 30000,
        }
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

      // Track sync statistics
      let syncedCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      // Sync each character
      for (const [eveId, characterData] of uniqueCharacters) {
        try {
          const result = await this.syncCharacter(
            eveId.toString(),
            characterData
          );
          if (result === "synced") {
            syncedCount++;
          } else if (result === "skipped") {
            skippedCount++;
          }
        } catch (error) {
          errorCount++;
          logger.error(`Error syncing character ${eveId}: ${error}`);
        }
      }

      // Log summary
      logger.info(
        `Character sync summary for map ${mapName}: total=${uniqueCharacters.size}, synced=${syncedCount}, skipped=${skippedCount}, errors=${errorCount}`
      );
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
  ): Promise<"synced" | "skipped"> {
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
        const esiData = await retryOperation(
          () => this.esiService.getCharacter(parseInt(eveId)),
          `Fetching character name for ${eveId}`,
          {
            maxRetries: this.maxRetries,
            initialRetryDelay: this.retryDelay,
            timeout: 30000,
          }
        );

        if (!esiData) {
          logger.warn(`No ESI data available for character ${eveId}`);
          return "skipped";
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
      return "synced";
    } catch (error: any) {
      logger.error(`Error syncing character ${eveId}: ${error.message}`);
      throw error;
    }
  }

  public async close(): Promise<void> {
    // No resources to clean up at the moment
  }
}
