import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

/**
 * This script finds and merges duplicate character groups.
 * It identifies groups that have characters from the same source (like same main character)
 * and consolidates them into a single group.
 */
export async function mergeDuplicateGroups() {
  const prisma = new PrismaClient();

  try {
    logger.info("Starting duplicate character group merger");

    // Group characters by their main character ID
    const charactersByMain = new Map<string, Set<string>>();
    const characterGroups = new Map<string, Set<string>>();

    // Get all characters that have a main character
    const characters = await prisma.character.findMany({
      where: {
        mainCharacterId: {
          not: null,
        },
      },
      select: {
        eveId: true,
        mainCharacterId: true,
        characterGroupId: true,
      },
    });

    logger.info(`Found ${characters.length} characters with main characters`);

    // Group characters by their main character
    for (const char of characters) {
      if (!char.mainCharacterId || !char.characterGroupId) continue;

      // Initialize sets if they don't exist
      if (!charactersByMain.has(char.mainCharacterId)) {
        charactersByMain.set(char.mainCharacterId, new Set());
      }
      if (!characterGroups.has(char.mainCharacterId)) {
        characterGroups.set(char.mainCharacterId, new Set());
      }

      // Add character to main's set
      charactersByMain.get(char.mainCharacterId)!.add(char.eveId);

      // Track which groups this main's characters belong to
      characterGroups.get(char.mainCharacterId)!.add(char.characterGroupId);
    }

    // Find mains whose characters are spread across multiple groups
    const duplicateGroups = new Map<string, string[]>();
    for (const [mainId, groups] of characterGroups.entries()) {
      if (groups.size > 1) {
        duplicateGroups.set(mainId, Array.from(groups));
      }
    }

    logger.info(
      `Found ${duplicateGroups.size} mains with characters in multiple groups`
    );

    // Process each main with duplicate groups
    let totalMerged = 0;
    let totalMovedCharacters = 0;

    for (const [mainId, groupIds] of duplicateGroups.entries()) {
      try {
        logger.info(
          `Processing main ${mainId} with characters in ${groupIds.length} groups`
        );

        // Get information about the groups
        const groups = await prisma.characterGroup.findMany({
          where: {
            id: {
              in: groupIds,
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

        // Sort groups by character count in descending order
        groups.sort((a, b) => b._count.characters - a._count.characters);

        // Keep the largest group, merge others into it
        const targetGroup = groups[0];
        const groupsToMerge = groups.slice(1);

        logger.info(
          `Keeping largest group ${targetGroup.id} (${targetGroup.slug}) with ${targetGroup._count.characters} characters`
        );

        // Update characters in the other groups to point to the target group
        for (const group of groupsToMerge) {
          const charactersToMove = await prisma.character.findMany({
            where: {
              characterGroupId: group.id,
            },
            select: {
              eveId: true,
              name: true,
            },
          });

          if (charactersToMove.length === 0) continue;

          logger.info(
            `Moving ${charactersToMove.length} characters from group ${group.id} (${group.slug}) to group ${targetGroup.id}`
          );

          // Move characters to the target group
          await prisma.character.updateMany({
            where: {
              characterGroupId: group.id,
            },
            data: {
              characterGroupId: targetGroup.id,
            },
          });

          totalMovedCharacters += charactersToMove.length;

          // Delete the now-empty group
          await prisma.characterGroup.delete({
            where: {
              id: group.id,
            },
          });

          logger.info(`Deleted empty group ${group.id} (${group.slug})`);
          totalMerged++;
        }
      } catch (error) {
        logger.error(
          `Error processing main ${mainId}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    logger.info(
      `Merged ${totalMerged} duplicate groups and moved ${totalMovedCharacters} characters`
    );

    // Run a final check for any empty groups
    const emptyGroups = await prisma.characterGroup.findMany({
      where: {
        characters: {
          none: {},
        },
      },
    });

    logger.info(`Found ${emptyGroups.length} empty groups after merging`);

    if (emptyGroups.length > 0) {
      logger.info(`Cleaning up ${emptyGroups.length} empty groups`);
      await prisma.characterGroup.deleteMany({
        where: {
          id: {
            in: emptyGroups.map((g) => g.id),
          },
        },
      });
    }

    // Final stats
    const finalGroups = await prisma.characterGroup.count();
    logger.info(`Finished with ${finalGroups} character groups`);
  } catch (error) {
    logger.error("Error during duplicate group merger:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}


