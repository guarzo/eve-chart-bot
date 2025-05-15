import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger";

/**
 * Utility class for safely managing character groups
 * to prevent empty groups from being created
 */
export class CharacterGroupUtils {
  /**
   * Create a character group only if we have characters to associate with it
   * @param prisma Prisma client instance
   * @param slug The group slug
   * @param characterIds Array of character IDs to associate with the group
   * @param mainCharacterId Optional main character ID for the group
   * @returns The created group ID or null if no group was created
   */
  static async createCharacterGroupSafely(
    prisma: PrismaClient,
    slug: string,
    characterIds: string[],
    mainCharacterId?: string
  ): Promise<string | null> {
    try {
      // Validate inputs
      if (!slug) {
        logger.error("Cannot create group: missing slug");
        return null;
      }

      if (!characterIds || characterIds.length === 0) {
        logger.warn(`Cannot create group '${slug}': no characters provided`);
        return null;
      }

      // First, check if any of these characters already belong to a group
      const existingCharacters = await prisma.character.findMany({
        where: {
          eveId: {
            in: characterIds,
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
          logger.warn("Character has null characterGroup");
          return null;
        }
        logger.info(
          `Found existing group ${existingGroup.id} (${existingGroup.slug}) for ${existingCharacters.length} characters`
        );

        // Update all provided characters to use this group
        await Promise.all(
          characterIds.map((charId) =>
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
            data: { mainCharacterId },
          });
        }

        return existingGroup.id;
      }

      // Check if characters exist in the database
      const charactersInDb = await prisma.character.findMany({
        where: {
          eveId: {
            in: characterIds,
          },
        },
      });

      if (charactersInDb.length === 0) {
        logger.warn(`Cannot create group '${slug}': no valid characters found`);
        return null;
      }

      logger.info(
        `Creating character group '${slug}' with ${charactersInDb.length} characters`
      );

      // Use a transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Create the group first
        const group = await tx.characterGroup.create({
          data: {
            slug,
            mainCharacterId: mainCharacterId || null,
          },
        });

        // Associate characters with the group
        await Promise.all(
          charactersInDb.map((char) =>
            tx.character.update({
              where: { eveId: char.eveId },
              data: { characterGroupId: group.id },
            })
          )
        );

        return group;
      });

      logger.info(
        `Successfully created character group ${result.id} with ${charactersInDb.length} characters`
      );
      return result.id;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        `Failed to create character group '${slug}'`
      );
      return null;
    }
  }

  /**
   * A safer version of the upsert operation that ensures groups always have characters
   * @param prisma Prisma client instance
   * @param slug The group slug
   * @param characterIds Array of character IDs to associate with the group
   * @param mainCharacterId Optional main character ID for the group
   * @returns The created/updated group ID or null if no group was created/updated
   */
  static async upsertCharacterGroupSafely(
    prisma: PrismaClient,
    slug: string,
    characterIds: string[],
    mainCharacterId?: string
  ): Promise<string | null> {
    try {
      // First, check if any of these characters already belong to a group
      if (characterIds && characterIds.length > 0) {
        const existingCharacters = await prisma.character.findMany({
          where: {
            eveId: {
              in: characterIds,
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
            logger.warn("Character has null characterGroup");
            return null;
          }
          logger.info(
            `Found existing group ${existingGroup.id} (${existingGroup.slug}) for ${existingCharacters.length} characters`
          );

          // Update all provided characters to use this group
          await Promise.all(
            characterIds.map((charId) =>
              prisma.character
                .update({
                  where: { eveId: charId },
                  data: { characterGroupId: existingGroup.id },
                })
                .catch((e) => {
                  logger.warn(
                    `Could not update character ${charId}: ${e.message}`
                  );
                  return null;
                })
            )
          );

          // Update main character if provided
          if (mainCharacterId) {
            await prisma.characterGroup.update({
              where: { id: existingGroup.id },
              data: { mainCharacterId },
            });
          }

          return existingGroup.id;
        }
      }

      // Check if the group already exists by slug
      const existingGroup = await prisma.characterGroup.findUnique({
        where: { slug },
        include: { characters: true },
      });

      if (existingGroup) {
        if (existingGroup.mainCharacterId === mainCharacterId) {
          return existingGroup.id;
        }
        if (existingGroup.mainCharacterId) {
          return null;
        }

        // If group exists but has no characters, and we're not adding any, delete it
        if (
          existingGroup.characters.length === 0 &&
          (!characterIds || characterIds.length === 0)
        ) {
          logger.warn(
            `Deleting empty character group '${slug}' (${existingGroup.id})`
          );
          await prisma.characterGroup.delete({
            where: { id: existingGroup.id },
          });
          return null;
        }

        // Otherwise update the group
        if (characterIds && characterIds.length > 0) {
          // Update characters to be part of this group
          await Promise.all(
            characterIds.map((charId) =>
              prisma.character
                .update({
                  where: { eveId: charId },
                  data: { characterGroupId: existingGroup.id },
                })
                .catch((e) => {
                  logger.warn(
                    `Could not update character ${charId}: ${e.message}`
                  );
                  return null;
                })
            )
          );
        }

        // Update main character if provided
        if (mainCharacterId) {
          await prisma.characterGroup.update({
            where: { id: existingGroup.id },
            data: { mainCharacterId },
          });
        }

        logger.info(
          `Updated character group '${slug}' (${existingGroup.id}) with ${
            characterIds?.length || 0
          } characters`
        );
        return existingGroup.id;
      }

      // If group doesn't exist, create it (but only if we have characters)
      return await this.createCharacterGroupSafely(
        prisma,
        slug,
        characterIds,
        mainCharacterId
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        `Failed to upsert character group '${slug}'`
      );
      return null;
    }
  }

  /**
   * Clean up any existing empty character groups
   * @param prisma Prisma client instance
   * @returns Number of empty groups deleted
   */
  static async cleanupEmptyCharacterGroups(
    prisma: PrismaClient
  ): Promise<number> {
    try {
      // Find all empty groups
      const emptyGroups = await prisma.characterGroup.findMany({
        where: {
          characters: {
            none: {},
          },
        },
        select: {
          id: true,
          slug: true,
        },
      });

      logger.info(`Found ${emptyGroups.length} empty character groups`);

      if (emptyGroups.length === 0) {
        return 0;
      }

      // Delete all empty groups
      await prisma.characterGroup.deleteMany({
        where: {
          id: {
            in: emptyGroups.map((g) => g.id),
          },
        },
      });

      logger.info(`Deleted ${emptyGroups.length} empty character groups`);
      return emptyGroups.length;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        `Failed to cleanup empty character groups`
      );
      return 0;
    }
  }
}
