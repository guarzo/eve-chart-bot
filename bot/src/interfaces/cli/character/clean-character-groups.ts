import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

const prisma = new PrismaClient();

/**
 * This script cleans up the character_group table by:
 * 1. Removing all empty groups (no characters associated)
 * 2. Removing duplicate groups with the same slug
 * 3. Fixing any groups with invalid data
 */
export async function cleanCharacterGroups() {
  try {
    logger.info("Starting character group cleanup process");

    // Get count before cleanup
    const beforeCount = await prisma.characterGroup.count();
    logger.info(`Starting with ${beforeCount} character groups`);

    // Step 1: Find and delete empty groups
    const emptyGroups = await prisma.characterGroup.findMany({
      where: {
        characters: {
          none: {},
        },
      },
      select: {
        id: true,
      },
    });

    logger.info(`Found ${emptyGroups.length} empty character groups to delete`);

    if (emptyGroups.length > 0) {
      // Delete in batches of 1000 to avoid overloading the database
      const batchSize = 1000;
      for (let i = 0; i < emptyGroups.length; i += batchSize) {
        const batchIds = emptyGroups.slice(i, i + batchSize).map((g) => g.id);

        await prisma.characterGroup.deleteMany({
          where: {
            id: {
              in: batchIds,
            },
          },
        });

        logger.info(
          `Deleted batch ${Math.floor(i / batchSize) + 1} of empty groups (${
            batchIds.length
          } groups)`
        );
      }
    }

    // Step 2: Find and handle duplicate slug groups
    const groups = await prisma.characterGroup.findMany({
      select: {
        id: true,
        slug: true,
        _count: {
          select: { characters: true },
        },
      },
    });

    // Group by slug
    const slugGroups = new Map<
      string,
      Array<{ id: string; characterCount: number }>
    >();

    for (const group of groups) {
      if (!group.slug) continue;

      if (!slugGroups.has(group.slug)) {
        slugGroups.set(group.slug, []);
      }

      slugGroups.get(group.slug)!.push({
        id: group.id,
        characterCount: group._count.characters,
      });
    }

    // Find duplicates
    const duplicates = Array.from(slugGroups.entries())
      .filter(([_, groups]) => groups.length > 1)
      .map(([slug, groups]) => ({ slug, groups }));

    logger.info(`Found ${duplicates.length} slugs with duplicate groups`);

    // For each set of duplicates, keep the one with most characters and delete the rest
    let deletedDuplicates = 0;
    for (const { slug, groups } of duplicates) {
      // Sort by character count descending
      groups.sort((a, b) => b.characterCount - a.characterCount);

      // Keep the first one (most characters)
      const keepGroupId = groups[0].id;
      const groupsToDelete = groups.slice(1).map((g) => g.id);

      if (groupsToDelete.length > 0) {
        // Update characters to point to the group we're keeping
        await prisma.character.updateMany({
          where: {
            characterGroupId: {
              in: groupsToDelete,
            },
          },
          data: {
            characterGroupId: keepGroupId,
          },
        });

        // Delete the duplicate groups
        await prisma.characterGroup.deleteMany({
          where: {
            id: {
              in: groupsToDelete,
            },
          },
        });

        deletedDuplicates += groupsToDelete.length;
        logger.info(
          `Consolidated duplicate groups for slug '${slug}', keeping ${keepGroupId}, deleted ${groupsToDelete.length} groups`
        );
      }
    }

    logger.info(`Total deleted duplicate groups: ${deletedDuplicates}`);

    // Get count after cleanup
    const afterCount = await prisma.characterGroup.count();
    logger.info(
      `Cleanup complete. Character groups: ${beforeCount} → ${afterCount} (${
        beforeCount - afterCount
      } removed)`
    );

    // Sample remaining groups
    const remainingGroups = await prisma.characterGroup.findMany({
      take: 10,
      include: {
        _count: {
          select: { characters: true },
        },
      },
    });

    logger.info("Sample of remaining groups:");
    for (const group of remainingGroups) {
      logger.info(
        `Group: ${group.id}, Slug: ${group.slug}, Characters: ${group._count.characters}`
      );
    }
  } catch (error) {
    logger.error("Error during character group cleanup:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}


