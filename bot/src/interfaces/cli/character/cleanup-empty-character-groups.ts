import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

const prisma = new PrismaClient();

/**
 * Script to clean up empty character groups
 * This addresses the issue of having character groups with no characters assigned
 */
async function cleanupEmptyCharacterGroups() {
  try {
    logger.info("Starting character group cleanup...");

    // Get all character groups
    const groups = await prisma.characterGroup.findMany({
      include: {
        characters: true,
        mainCharacter: true,
      },
    });

    logger.info(`Found ${groups.length} total character groups`);

    // Find groups with no characters
    const emptyGroups = groups.filter((group) => group.characters.length === 0);

    logger.info(`Found ${emptyGroups.length} empty character groups`);

    if (emptyGroups.length === 0) {
      logger.info("No empty character groups to clean up");
      return;
    }

    // Delete empty groups
    const emptyGroupIds = emptyGroups.map((group) => group.id);

    const deleteResult = await prisma.characterGroup.deleteMany({
      where: {
        id: {
          in: emptyGroupIds,
        },
      },
    });

    logger.info(`Deleted ${deleteResult.count} empty character groups`);

    // Find groups with inconsistent main character references
    const inconsistentGroups = groups.filter(
      (group) => group.mainCharacterId && !group.mainCharacter
    );

    logger.info(
      `Found ${inconsistentGroups.length} groups with invalid main character references`
    );

    // Fix inconsistent main character references
    for (const group of inconsistentGroups) {
      // Find a character in this group to be the main
      const characters = await prisma.character.findMany({
        where: {
          characterGroupId: group.id,
        },
      });

      if (characters.length > 0) {
        // Find a main character or use the first one
        const mainChar =
          characters.find((char) => char.isMain) || characters[0];

        await prisma.characterGroup.update({
          where: {
            id: group.id,
          },
          data: {
            mainCharacterId: mainChar.eveId,
          },
        });

        logger.info(
          `Updated group ${group.id} to use ${mainChar.name} as main character`
        );
      } else {
        // If no characters in this group, delete it
        await prisma.characterGroup.delete({
          where: {
            id: group.id,
          },
        });

        logger.info(`Deleted group ${group.id} with no characters`);
      }
    }

    logger.info("Character group cleanup completed successfully");
  } catch (error) {
    logger.error("Error during character group cleanup:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupEmptyCharacterGroups().catch((error) => {
  logger.error("Unhandled error in cleanup script:", error);
});
