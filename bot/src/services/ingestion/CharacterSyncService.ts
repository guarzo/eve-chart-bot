import { ESIService } from "../ESIService";
import { retryOperation } from "../../utils/retry";
import { logger } from "../../lib/logger";
import { Character } from "../../domain/character/Character";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";
import { MapClient } from "../../infrastructure/http/MapClient";
import { PrismaClient } from "@prisma/client";

export class CharacterSyncService {
  private readonly characterRepository: CharacterRepository;
  private readonly esiService: ESIService;
  private readonly map: MapClient;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly prisma: PrismaClient;

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
    this.prisma = new PrismaClient();
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

      // Automatically create character groups after syncing
      await this.createCharacterGroups();

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

  /**
   * Create character groups based on users from Map API after character sync
   */
  private async createCharacterGroups(): Promise<void> {
    try {
      logger.info(
        "Creating character groups based on Map API user groupings..."
      );

      const mapName = process.env.MAP_NAME;
      if (!mapName) {
        logger.warn("MAP_NAME not set, cannot create groups");
        return;
      }

      // Get the same map data to see the user groupings
      const mapData = await retryOperation(
        () => this.map.getUserCharacters(mapName),
        `Fetching user groups for map ${mapName}`,
        {
          maxRetries: this.maxRetries,
          initialRetryDelay: this.retryDelay,
          timeout: 30000,
        }
      );

      if (!mapData?.data || !Array.isArray(mapData.data)) {
        logger.warn(`No valid user data available for map ${mapName}`);
        return;
      }

      logger.info(`Found ${mapData.data.length} user groups to process`);

      // Process each user group
      for (let i = 0; i < mapData.data.length; i++) {
        const user = mapData.data[i];
        const userCharacters = user.characters || [];

        if (userCharacters.length === 0) {
          logger.info(`Skipping user ${i} - no characters`);
          continue;
        }

        // Extract character IDs for this group
        const characterIds = userCharacters.map((c) => BigInt(c.eve_id));

        // Check if we already have a group containing any of these characters
        const existingGroup = await this.prisma.characterGroup.findFirst({
          where: {
            characters: {
              some: {
                eveId: { in: characterIds },
              },
            },
          },
          include: {
            characters: true,
          },
        });

        let groupId: string;
        let groupName: string;

        if (existingGroup) {
          // Use existing group
          groupId = existingGroup.id;
          groupName = existingGroup.map_name;
          logger.info(
            `Found existing group ${groupName} (${groupId}) for user ${i}`
          );

          // Check if we need to update the main character
          // Use the main_character_eve_id from API, or fall back to first character if null
          const intendedMainCharId = user.main_character_eve_id
            ? BigInt(user.main_character_eve_id)
            : BigInt(userCharacters[0].eve_id);

          if (existingGroup.mainCharacterId !== intendedMainCharId) {
            await this.prisma.characterGroup.update({
              where: { id: groupId },
              data: { mainCharacterId: intendedMainCharId },
            });
            logger.info(
              `Updated main character for group ${groupName} to character ${intendedMainCharId}`
            );
          }
        } else {
          // Create new group - use a stable identifier based on user index and main character
          const mainCharacterId = user.main_character_eve_id
            ? BigInt(user.main_character_eve_id)
            : BigInt(userCharacters[0].eve_id);

          groupName = `user-${i}-${mainCharacterId}`;

          logger.info(
            `Creating new group ${groupName} with ${userCharacters.length} characters`
          );

          const group = await this.prisma.characterGroup.create({
            data: {
              map_name: mapName, // Use the MAP_NAME environment variable
              mainCharacterId: mainCharacterId,
            },
          });
          groupId = group.id;
          logger.info(`Created new group ${groupName} (${groupId})`);
        }

        // Ensure all characters in this user are assigned to this group
        for (const character of userCharacters) {
          try {
            await this.prisma.character.updateMany({
              where: { eveId: BigInt(character.eve_id) },
              data: { characterGroupId: groupId },
            });
          } catch (error) {
            logger.warn(
              `Could not assign character ${character.eve_id} to group ${groupName}: ${error}`
            );
          }
        }

        logger.info(
          `Successfully processed group ${groupName} with ${userCharacters.length} characters`
        );
      }

      logger.info(
        "Successfully processed all character groups from Map API users"
      );
    } catch (error) {
      logger.error(
        "Error creating character groups from Map API users:",
        error
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
    await this.prisma.$disconnect();
  }
}
