import { ESIService } from '../ESIService';
// import { retryOperation } from '../../shared/performance/retry';
import { logger } from '../../lib/logger';
import { Character } from '../../domain/character/Character';
import { CharacterRepository } from '../../infrastructure/repositories/CharacterRepository';
import { MapClient } from '../../infrastructure/http/MapClient';
import { PrismaClient } from '@prisma/client';
import prisma from '../../infrastructure/persistence/client';
import { ValidatedConfiguration as Configuration } from '../../config/validated';
import { errorHandler, ExternalServiceError, ValidationError } from '../../shared/errors';

export class CharacterSyncService {
  private readonly characterRepository: CharacterRepository;
  private readonly esiService: ESIService;
  private readonly map: MapClient;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly prisma: PrismaClient;

  constructor(mapApiUrl: string, mapApiKey: string, maxRetries: number = 3, retryDelay: number = 5000) {
    this.characterRepository = new CharacterRepository(prisma);
    this.esiService = new ESIService();
    this.map = new MapClient(mapApiUrl, mapApiKey);
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    this.prisma = prisma;
  }

  /**
   * Start the character sync service
   */
  public async start(): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      logger.info('Starting character sync service...', {
        correlationId,
      });

      const mapName = Configuration.apis.map.name;
      if (!mapName) {
        logger.warn('MAP_NAME environment variable not set, skipping character sync', {
          correlationId,
        });
        return;
      }

      // Validate map name
      if (typeof mapName !== 'string' || mapName.trim().length === 0) {
        throw ValidationError.invalidFormat('mapName', 'non-empty string', mapName, {
          correlationId,
          operation: 'characterSync.start',
        });
      }

      logger.debug(`Fetching character data for map ${mapName}`, {
        correlationId,
        mapName,
      });

      // Fetch map data once and use it for both operations
      const mapData = await errorHandler.withRetry(
        async () => {
          const result = await this.map.getUserCharacters(mapName);
          if (!result) {
            throw new ExternalServiceError('MAP_API', 'No data returned from Map API', '/characters', undefined, {
              correlationId,
              operation: 'getUserCharacters',
              metadata: { mapName },
            });
          }
          return result;
        },
        this.maxRetries,
        this.retryDelay,
        {
          correlationId,
          operation: 'characterSync.getUserCharacters',
          metadata: { mapName },
        }
      );

      if (!mapData?.data || !Array.isArray(mapData.data)) {
        logger.warn(`No valid character data available for map ${mapName}`, {
          correlationId,
          mapName,
          hasData: !!mapData,
          dataType: typeof mapData?.data,
        });
        return;
      }

      logger.debug(`Retrieved character data for map ${mapName}`, {
        correlationId,
        mapName,
        userCount: mapData.data.length,
      });

      const characterSyncResults = await this.syncUserCharacters(mapData);
      const groupResults = await this.createCharacterGroups(mapData, mapName);

      logger.info(
        `Character sync service started successfully - Characters: ${characterSyncResults.total} total (${characterSyncResults.synced} synced, ${characterSyncResults.skipped} skipped, ${characterSyncResults.errors} errors), Groups: ${groupResults.total} total (${groupResults.created} created, ${groupResults.updated} updated)`,
        {
          correlationId,
          mapName,
          characterSyncResults,
          groupResults,
        }
      );
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'start',
        metadata: { mapName: Configuration.apis.map.name },
      });
    }
  }

  public async syncUserCharacters(mapData: any): Promise<{
    total: number;
    synced: number;
    skipped: number;
    errors: number;
  }> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate input
      if (!mapData?.data || !Array.isArray(mapData.data)) {
        logger.warn(`No valid character data available`, {
          correlationId,
          hasMapData: !!mapData,
          dataType: typeof mapData?.data,
        });
        return { total: 0, synced: 0, skipped: 0, errors: 0 };
      }

      logger.info(`Syncing user characters from map data`, {
        correlationId,
        userCount: mapData.data.length,
      });

      // Extract unique characters from the map data
      const uniqueCharacters = new Map();
      for (const user of mapData.data) {
        if (!user.characters || !Array.isArray(user.characters)) {
          continue;
        }

        for (const character of user.characters) {
          if (character.eve_id) {
            uniqueCharacters.set(character.eve_id, character);
          }
        }
      }

      logger.debug(`Extracted ${uniqueCharacters.size} unique characters`, {
        correlationId,
        uniqueCharacterCount: uniqueCharacters.size,
      });

      // Track sync statistics
      let syncedCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      // Sync each character
      for (const [eveId, characterData] of uniqueCharacters) {
        try {
          const result = await this.syncCharacter(eveId.toString(), characterData);
          if (result === 'synced') {
            syncedCount++;
          } else if (result === 'skipped') {
            skippedCount++;
          }
        } catch (error) {
          errorCount++;
          logger.error(`Error syncing character ${eveId}`, {
            correlationId,
            eveId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      }

      const results = {
        total: uniqueCharacters.size,
        synced: syncedCount,
        skipped: skippedCount,
        errors: errorCount,
      };

      logger.info(`Character sync completed`, {
        correlationId,
        ...results,
      });

      return results;
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'syncUserCharacters',
        metadata: {
          hasMapData: !!mapData,
          userCount: mapData?.data?.length,
        },
      });
    }
  }

  /**
   * Create character groups based on users from Map API after character sync
   */
  private async createCharacterGroups(
    mapData: any,
    mapName: string
  ): Promise<{
    total: number;
    created: number;
    updated: number;
  }> {
    try {
      if (!mapData?.data || !Array.isArray(mapData.data)) {
        logger.warn(`No valid user data available for map ${mapName}`);
        return { total: 0, created: 0, updated: 0 };
      }

      let createdCount = 0;
      let updatedCount = 0;

      // Process each user group
      for (let i = 0; i < mapData.data.length; i++) {
        const user = mapData.data[i];
        const userCharacters = user.characters ?? [];

        if (userCharacters.length === 0) {
          continue;
        }

        // Extract character IDs for this group
        const characterIds = userCharacters.map((c: any) => BigInt(c.eve_id));

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
          groupName = existingGroup.mapName;

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
            updatedCount++;
          }
        } else {
          // Create new group - use a stable identifier based on user index and main character
          const mainCharacterId = user.main_character_eve_id
            ? BigInt(user.main_character_eve_id)
            : BigInt(userCharacters[0].eve_id);

          groupName = `user-${i}-${mainCharacterId}`;

          const group = await this.prisma.characterGroup.create({
            data: {
              mapName: mapName, // Use the MAP_NAME environment variable
              mainCharacterId: mainCharacterId,
            },
          });
          groupId = group.id;
          createdCount++;
        }

        // Ensure all characters in this user are assigned to this group
        for (const character of userCharacters) {
          try {
            await this.prisma.character.updateMany({
              where: { eveId: BigInt(character.eve_id) },
              data: { characterGroupId: groupId },
            });
          } catch (error) {
            logger.warn(`Could not assign character ${character.eve_id} to group ${groupName}: ${error}`);
          }
        }
      }

      return {
        total: mapData.data.length,
        created: createdCount,
        updated: updatedCount,
      };
    } catch (error) {
      logger.error('Error creating character groups from Map API users:', error);
      throw error;
    }
  }

  private async syncCharacter(eveId: string, mapCharacterData: any): Promise<'synced' | 'skipped'> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Validate inputs
      if (!eveId || typeof eveId !== 'string') {
        throw ValidationError.fieldRequired('eveId', {
          correlationId,
          operation: 'characterSync.syncCharacter',
        });
      }

      if (!mapCharacterData) {
        throw ValidationError.fieldRequired('mapCharacterData', {
          correlationId,
          operation: 'characterSync.syncCharacter',
          metadata: { eveId },
        });
      }

      logger.debug(`Syncing character ${eveId}`, {
        correlationId,
        eveId,
        corporationId: mapCharacterData.corporation_id,
      });

      // Check if character already exists
      const existingCharacter = await errorHandler.withRetry(
        async () => {
          return await this.characterRepository.getCharacter(BigInt(eveId));
        },
        3,
        1000,
        {
          correlationId,
          operation: 'characterSync.getExistingCharacter',
          metadata: { eveId },
        }
      );

      let characterName: string;
      if (existingCharacter) {
        // Use existing name for updates
        characterName = existingCharacter.name;
        logger.debug(`Using existing character name: ${characterName}`, {
          correlationId,
          eveId,
          characterName,
        });
      } else {
        // Get character name from ESI only for new characters
        logger.debug(`Fetching character name from ESI for new character ${eveId}`, {
          correlationId,
          eveId,
        });

        const esiData = await errorHandler.withRetry(
          async () => {
            return await this.esiService.getCharacter(parseInt(eveId));
          },
          this.maxRetries,
          this.retryDelay,
          {
            correlationId,
            operation: 'characterSync.getCharacterFromESI',
            metadata: { eveId },
          }
        );

        if (!esiData) {
          logger.warn(`No ESI data available for character ${eveId}`, {
            correlationId,
            eveId,
          });
          return 'skipped';
        }
        characterName = esiData.name;
      }

      // Create character instance using domain entity with data from both sources
      const character = new Character({
        eveId,
        name: characterName,
        corporationId: mapCharacterData.corporation_id,
        corporationTicker: mapCharacterData.corporation_ticker ?? '',
        allianceId: mapCharacterData.alliance_id,
        allianceTicker: mapCharacterData.alliance_ticker ?? '',
        createdAt: existingCharacter?.createdAt ?? new Date(),
        updatedAt: new Date(),
      });

      logger.debug(`Upserting character ${eveId}`, {
        correlationId,
        eveId,
        characterName: character.name,
        corporationId: character.corporationId,
      });

      // Save character using repository
      await errorHandler.withRetry(
        async () => {
          await this.characterRepository.upsertCharacter({
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
          operation: 'characterSync.upsertCharacter',
          metadata: { eveId, characterName },
        }
      );

      logger.debug(`Successfully synced character ${eveId}`, {
        correlationId,
        eveId,
        characterName,
      });

      return 'synced';
    } catch (error) {
      throw errorHandler.handleError(error, {
        correlationId,
        operation: 'syncCharacter',
        metadata: {
          eveId,
          corporationId: mapCharacterData?.corporation_id,
        },
      });
    }
  }

  public async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
