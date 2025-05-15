import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";

/**
 * Create a character group only if we have characters to associate with it
 * @param prisma Prisma client instance
 * @param slug The group slug
 * @param characterIds Array of character IDs to associate with the group
 * @param mainCharacterId Optional main character ID for the group
 * @returns The created group ID or null if no group was created
 */
export async function createCharacterGroupSafely(
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
    if (existingCharacters.length > 0 && existingCharacters[0].characterGroup) {
      // Use the first character's group as the target group for all characters
      const existingGroup = existingCharacters[0].characterGroup;
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
export async function upsertCharacterGroupSafely(
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
      if (
        existingCharacters.length > 0 &&
        existingCharacters[0].characterGroup
      ) {
        // Use the first character's group as the target group for all characters
        const existingGroup = existingCharacters[0].characterGroup;
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

    // If no existing group was found, create a new one
    return createCharacterGroupSafely(
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
 * Remove empty character groups to keep the database clean
 * @param prisma Prisma client instance
 * @returns The number of groups that were removed
 */
export async function cleanupEmptyCharacterGroups(
  prisma: PrismaClient
): Promise<number> {
  try {
    // Find groups with no characters
    const emptyGroups = await prisma.characterGroup.findMany({
      where: {
        characters: {
          none: {},
        },
      },
      include: {
        _count: {
          select: {
            characters: true,
          },
        },
      },
    });

    if (emptyGroups.length === 0) {
      logger.info("No empty character groups found");
      return 0;
    }

    logger.info(`Found ${emptyGroups.length} empty character groups to remove`);

    // Delete each empty group
    await Promise.all(
      emptyGroups.map((group) =>
        prisma.characterGroup.delete({
          where: { id: group.id },
        })
      )
    );

    logger.info(`Removed ${emptyGroups.length} empty character groups`);
    return emptyGroups.length;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Failed to cleanup empty character groups"
    );
    return 0;
  }
}
