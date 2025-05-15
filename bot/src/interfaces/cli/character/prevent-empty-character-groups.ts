import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

/**
 * This script demonstrates how to prevent empty character groups
 * by implementing a transaction-based approach for safely creating character groups
 * only when we have characters to associate with them.
 */

const prisma = new PrismaClient();

/**
 * Create a character group only if we have characters to associate with it
 * @param slug The group slug
 * @param characterIds Array of character IDs to associate with the group
 * @param mainCharacterId Optional main character ID for the group
 * @returns The created group ID or null if no group was created
 */
async function createCharacterGroupSafely(
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

    // Check if characters exist in the database
    const existingCharacters = await prisma.character.findMany({
      where: {
        eveId: {
          in: characterIds,
        },
      },
    });

    if (existingCharacters.length === 0) {
      logger.warn(`Cannot create group '${slug}': no valid characters found`);
      return null;
    }

    logger.info(
      `Creating character group '${slug}' with ${existingCharacters.length} characters`
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
        existingCharacters.map((char) =>
          tx.character.update({
            where: { eveId: char.eveId },
            data: { characterGroupId: group.id },
          })
        )
      );

      return group;
    });

    logger.info(
      `Successfully created character group ${result.id} with ${existingCharacters.length} characters`
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
 */
async function upsertCharacterGroupSafely(
  slug: string,
  characterIds: string[],
  mainCharacterId?: string
): Promise<string | null> {
  try {
    // Check if the group already exists
    const existingGroup = await prisma.characterGroup.findUnique({
      where: { slug },
      include: { characters: true },
    });

    if (existingGroup) {
      // If group exists but has no characters, and we're not adding any, delete it
      if (
        existingGroup.characters.length === 0 &&
        (!characterIds || characterIds.length === 0)
      ) {
        logger.warn(
          `Deleting empty character group '${slug}' (${existingGroup.id})`
        );
        await prisma.characterGroup.delete({ where: { id: existingGroup.id } });
        return null;
      }

      // Otherwise update the group
      if (characterIds && characterIds.length > 0) {
        // Update characters to be part of this group
        await Promise.all(
          characterIds.map((charId) =>
            prisma.character.update({
              where: { eveId: charId },
              data: { characterGroupId: existingGroup.id },
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
    return await createCharacterGroupSafely(
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
 * A demonstration of how to safely use these functions
 */
async function demonstrateSafeUsage() {
  logger.info("Demonstrating safe character group creation...");

  // Example 1: Try to create an empty group (should fail)
  const emptyGroupId = await createCharacterGroupSafely("empty-group", []);
  logger.info(`Empty group result: ${emptyGroupId || "Not created (good!)"}`);

  // Example 2: Create some characters and a valid group
  const charIds = [];
  for (let i = 1; i <= 3; i++) {
    try {
      const char = await prisma.character.create({
        data: {
          eveId: `test-char-${i}`,
          name: `Test Character ${i}`,
          corporationId: 12345,
          corporationTicker: "TEST",
          isMain: i === 1,
        },
      });
      charIds.push(char.eveId);
      logger.info(`Created test character: ${char.name} (${char.eveId})`);
    } catch (e) {
      logger.error(`Failed to create test character ${i}: ${e}`);
    }
  }

  // Create a group with these characters
  const validGroupId = await createCharacterGroupSafely(
    "valid-test-group",
    charIds,
    charIds[0]
  );
  logger.info(`Valid group result: ${validGroupId || "Failed!"}`);

  // Example 3: Try to update a group with no characters
  const noCharsResult = await upsertCharacterGroupSafely(
    "no-chars-group",
    [],
    undefined
  );
  logger.info(
    `No characters group result: ${noCharsResult || "Not created (good!)"}`
  );

  logger.info("Demonstration completed!");

  // Cleanup
  if (validGroupId) {
    await prisma.characterGroup.delete({ where: { id: validGroupId } });
  }
  for (const charId of charIds) {
    await prisma.character.delete({ where: { eveId: charId } });
  }
}

// Run the demonstration
demonstrateSafeUsage()
  .then(() => {
    logger.info("Script completed successfully");
    prisma.$disconnect();
  })
  .catch((error) => {
    logger.error("Script failed:", error);
    prisma.$disconnect();
    process.exit(1);
  });
