import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

const prisma = new PrismaClient();

/**
 * Remove a character by its EVE ID and optionally its associated character group
 * If the character is the only one in its group, the group will be removed as well
 */
export async function removeCharacter(characterId: string): Promise<void> {
  try {
    logger.info(`Starting removal of character with ID: ${characterId}`);

    // Find the character to verify it exists and get its group
    const character = await prisma.character.findUnique({
      where: { eveId: characterId },
      include: {
        characterGroup: {
          include: {
            _count: {
              select: { characters: true },
            },
          },
        },
      },
    });

    if (!character) {
      logger.error(`Character with ID ${characterId} not found`);
      return;
    }

    logger.info(
      `Found character: ${character.name} [${character.corporationTicker}]`
    );

    const characterGroupId = character.characterGroupId;
    let groupDeleted = false;

    // If character has a group and it's the only character in that group, remove the group
    if (characterGroupId && character.characterGroup) {
      const characterCount = character.characterGroup._count.characters;

      if (characterCount <= 1) {
        logger.info(
          `Character is the only one in group ${characterGroupId}, removing group`
        );

        // Delete the character group
        await prisma.characterGroup.delete({
          where: { id: characterGroupId },
        });

        logger.info(`Deleted character group: ${characterGroupId}`);
        groupDeleted = true;
      } else if (character.characterGroup.mainCharacterId === characterId) {
        // Character is the main character of the group, need to update the group
        logger.info(
          `Character is the main character of group ${characterGroupId}, updating group`
        );

        // Find another character in this group to be the new main
        const otherCharacter = await prisma.character.findFirst({
          where: {
            characterGroupId: characterGroupId,
            eveId: { not: characterId },
          },
        });

        if (otherCharacter) {
          // Update the group to use the other character as main
          await prisma.characterGroup.update({
            where: { id: characterGroupId },
            data: { mainCharacterId: otherCharacter.eveId },
          });

          logger.info(
            `Updated group ${characterGroupId} to use ${otherCharacter.name} as main character`
          );
        }
      }
    }

    // Now delete the character
    await prisma.character.delete({
      where: { eveId: characterId },
    });

    logger.info(
      `Successfully deleted character: ${character.name} [${character.corporationTicker}]`
    );

    if (characterGroupId && !groupDeleted) {
      logger.info(
        `Character group ${characterGroupId} was kept as it contains other characters`
      );
    }
  } catch (error) {
    logger.error("Error removing character:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      characterId,
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
