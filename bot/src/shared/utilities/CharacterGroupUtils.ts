import { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger';

/**
 * Utility class for safely managing character groups
 * to prevent empty groups from being created
 */
export class CharacterGroupUtils {
  /**
   * Create a character group only if we have characters to associate with it
   * @param prisma Prisma client instance
   * @param mapName The group map name
   * @param characterIds Array of character IDs to associate with the group
   * @param mainCharacterId Optional main character ID for the group
   * @returns The created group ID or null if no group was created
   */
  static async createCharacterGroupSafely(
    prisma: PrismaClient,
    mapName: string,
    characterIds: string[],
    mainCharacterId?: string
  ): Promise<string | null> {
    try {
      // Validate inputs
      if (!mapName) {
        logger.error('Cannot create group: missing map name');
        return null;
      }

      if (!characterIds || characterIds.length === 0) {
        logger.warn(`Cannot create group '${mapName}': no characters provided`);
        return null;
      }

      // Convert character IDs to BigInt for database queries
      const characterIdsBigInt = characterIds.map(id => BigInt(id));

      // First, check if any of these characters already belong to a group
      const existingCharacters = await prisma.character.findMany({
        where: {
          eveId: {
            in: characterIdsBigInt,
          },
          characterGroupId: {
            not: null,
          },
        },
        include: {
          characterGroup: true,
        },
      });

      // If some characters already belong to a group, use that group instead of creating a new one
      if (existingCharacters.length > 0) {
        // Use the first character's group as the target group for all characters
        const existingGroup = existingCharacters[0].characterGroup;
        if (!existingGroup) {
          logger.warn('Character has null characterGroup');
          return null;
        }
        logger.info(
          `Found existing group ${existingGroup.id} (${existingGroup.mapName}) for ${existingCharacters.length} characters`
        );

        // Update all provided characters to use this group
        await Promise.all(
          characterIdsBigInt.map(charId =>
            prisma.character.updateMany({
              where: { eveId: charId },
              data: { characterGroupId: existingGroup.id },
            })
          )
        );

        // Update main character if provided
        if (mainCharacterId) {
          await prisma.characterGroup.update({
            where: { id: existingGroup.id },
            data: { mainCharacterId: BigInt(mainCharacterId) },
          });
        }

        return existingGroup.id;
      }

      // Check if characters exist in the database
      const charactersInDb = await prisma.character.findMany({
        where: {
          eveId: {
            in: characterIdsBigInt,
          },
        },
      });

      if (charactersInDb.length === 0) {
        logger.warn(`Cannot create group '${mapName}': no valid characters found`);
        return null;
      }

      logger.info(`Creating character group '${mapName}' with ${charactersInDb.length} characters`);

      // Use a transaction to ensure atomicity
      const result = await prisma.$transaction(async tx => {
        // Create the group first
        const group = await tx.characterGroup.create({
          data: {
            mapName: mapName,
            mainCharacterId: mainCharacterId ? BigInt(mainCharacterId) : null,
          },
        });

        // Associate characters with the group
        await Promise.all(
          charactersInDb.map(char =>
            tx.character.update({
              where: { eveId: char.eveId },
              data: { characterGroupId: group.id },
            })
          )
        );

        return group;
      });

      logger.info(`Successfully created character group ${result.id} with ${charactersInDb.length} characters`);
      return result.id;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        `Failed to create character group '${mapName}'`
      );
      return null;
    }
  }

  /**
   * A safer version of the upsert operation that ensures groups always have characters
   * @param prisma Prisma client instance
   * @param mapName The group map name
   * @param characterIds Array of character IDs to associate with the group
   * @param mainCharacterId Optional main character ID for the group
   * @returns The created/updated group ID or null if no group was created/updated
   */
  static async upsertCharacterGroupSafely(
    prisma: PrismaClient,
    mapName: string,
    characterIds: string[],
    mainCharacterId?: string
  ): Promise<string | null> {
    try {
      // First, check if any of these characters already belong to a group
      if (characterIds && characterIds.length > 0) {
        // Convert character IDs to BigInt for database queries
        const characterIdsBigInt = characterIds.map(id => BigInt(id));

        const existingCharacters = await prisma.character.findMany({
          where: {
            eveId: {
              in: characterIdsBigInt,
            },
            characterGroupId: {
              not: null,
            },
          },
          include: {
            characterGroup: true,
          },
        });

        // If some characters already belong to a group, use that group instead of creating a new one
        if (existingCharacters.length > 0) {
          // Use the first character's group as the target group for all characters
          const existingGroup = existingCharacters[0].characterGroup;
          if (!existingGroup) {
            logger.warn('Character has null characterGroup');
            return null;
          }
          logger.info(
            `Found existing group ${existingGroup.id} (${existingGroup.mapName}) for ${existingCharacters.length} characters`
          );

          // Update all provided characters to use this group
          await Promise.all(
            characterIdsBigInt.map(charId =>
              prisma.character
                .update({
                  where: { eveId: charId },
                  data: { characterGroupId: existingGroup.id },
                })
                .catch(e => {
                  logger.warn(`Could not update character ${charId}: ${e.message}`);
                  return null;
                })
            )
          );

          // Update main character if provided
          if (mainCharacterId && existingGroup.mainCharacterId?.toString() !== mainCharacterId) {
            await prisma.characterGroup.update({
              where: { id: existingGroup.id },
              data: { mainCharacterId: BigInt(mainCharacterId) },
            });
          }

          return existingGroup.id;
        }
      }

      // Try to find existing group by map name
      const existingGroupByMapName = await prisma.characterGroup.findFirst({
        where: { mapName: mapName },
        include: { characters: true },
      });

      if (existingGroupByMapName) {
        // Group exists but may need character updates
        if (characterIds && characterIds.length > 0) {
          // Convert character IDs to BigInt
          const characterIdsBigInt = characterIds.map(id => BigInt(id));

          // Update characters to belong to this group
          await Promise.all(
            characterIdsBigInt.map(charId =>
              prisma.character
                .update({
                  where: { eveId: charId },
                  data: { characterGroupId: existingGroupByMapName.id },
                })
                .catch(e => {
                  logger.warn(`Could not update character ${charId}: ${e.message}`);
                  return null;
                })
            )
          );
        }

        // Update main character if provided
        if (mainCharacterId && existingGroupByMapName.mainCharacterId?.toString() !== mainCharacterId) {
          await prisma.characterGroup.update({
            where: { id: existingGroupByMapName.id },
            data: { mainCharacterId: BigInt(mainCharacterId) },
          });
        }

        return existingGroupByMapName.id;
      }

      // No existing group found, create new one using safe method
      return await CharacterGroupUtils.createCharacterGroupSafely(prisma, mapName, characterIds, mainCharacterId);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        `Failed to upsert character group '${mapName}'`
      );
      return null;
    }
  }

  /**
   * Clean up empty character groups (groups with no associated characters)
   * @param prisma Prisma client instance
   * @returns Number of groups deleted
   */
  static async cleanupEmptyCharacterGroups(prisma: PrismaClient): Promise<number> {
    try {
      // Find all groups that have no characters
      const emptyGroups = await prisma.characterGroup.findMany({
        where: {
          characters: {
            none: {},
          },
        },
        select: {
          id: true,
          mapName: true,
        },
      });

      if (emptyGroups.length === 0) {
        logger.info('No empty character groups found');
        return 0;
      }

      logger.info(`Found ${emptyGroups.length} empty character groups to delete`);

      // Delete all empty groups
      const deletedCount = await prisma.characterGroup.deleteMany({
        where: {
          id: {
            in: emptyGroups.map(group => group.id),
          },
        },
      });

      logger.info(
        `Deleted ${deletedCount.count} empty character groups: ${emptyGroups
          .map(g => `${g.mapName} (${g.id})`)
          .join(', ')}`
      );

      return deletedCount.count;
    } catch (error) {
      logger.error('Failed to cleanup empty character groups:', error);
      return 0;
    }
  }
}
