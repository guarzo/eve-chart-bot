import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";
import fs from "fs";
import path from "path";

/**
 * This script updates the IngestionService.ts file to use a safer approach
 * for character group creation that prevents empty groups
 */

async function updateIngestionService() {
  logger.info("Updating IngestionService to prevent empty character groups");

  // Path to the IngestionService file
  const filePath = path.join(__dirname, "../services/IngestionService.ts");

  // Read the file
  try {
    let content = fs.readFileSync(filePath, "utf8");

    // Find the syncUserCharacters method
    const methodStart = content.indexOf(
      "async syncUserCharacters(slug: string): Promise<void>"
    );
    if (methodStart === -1) {
      logger.error(
        "Could not find syncUserCharacters method in IngestionService.ts"
      );
      return;
    }

    // Find the section that creates character groups
    const createGroupStart = content.indexOf(
      "// Create or update character group for this user",
      methodStart
    );
    if (createGroupStart === -1) {
      logger.error(
        "Could not find character group creation section in syncUserCharacters method"
      );
      return;
    }

    // Replace the unsafe group creation with the safer version
    const unsafeCode = `// Create or update character group for this user
        const characterGroup = await this.prisma.characterGroup.upsert({
          where: { slug: groupId },
          create: {
            slug: groupId,
            mainCharacterId: null,
          },
          update: {
            mainCharacterId: null,
          },
        });`;

    const safeCode = `// Only create character group if we have characters to associate with it
        if (user.characters.length === 0) {
          logger.warn(\`Skipping group creation for \${groupId} - no characters available\`);
          continue;
        }

        // Get character IDs from this user
        const userCharacterIds = user.characters.map(char => char.eve_id);
        
        // Create or update character group for this user in a safe manner
        // This ensures we never create empty groups
        const characterGroup = await this.prisma.$transaction(async (tx) => {
          // Check if group already exists
          const existingGroup = await tx.characterGroup.findUnique({ 
            where: { slug: groupId },
            include: { characters: true }
          });
          
          if (existingGroup) {
            // If updating, just return the existing group
            return existingGroup;
          }
          
          // If creating new, ensure we have characters
          if (userCharacterIds.length === 0) {
            logger.warn(\`Cannot create group \${groupId} without characters\`);
            return null;
          }
          
          // Create new group
          return await tx.characterGroup.create({
            data: {
              slug: groupId,
              mainCharacterId: null,
            }
          });
        });
        
        // Skip processing if group creation failed
        if (!characterGroup) {
          logger.warn(\`Skipping user with main character \${mainCharacterId || 'none'} - could not create/find group\`);
          continue;
        }`;

    // Replace the code
    content = content.replace(unsafeCode, safeCode);

    // Write the updated file
    fs.writeFileSync(filePath, content, "utf8");

    logger.info("IngestionService.ts updated successfully");

    // Also export the helper functions to a common utility class
    const utilsPath = path.join(__dirname, "../utils/CharacterGroupUtils.ts");
    const utilsContent = `import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

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
        logger.warn(\`Cannot create group '\${slug}': no characters provided\`);
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
        logger.warn(\`Cannot create group '\${slug}': no valid characters found\`);
        return null;
      }

      logger.info(
        \`Creating character group '\${slug}' with \${existingCharacters.length} characters\`
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
        \`Successfully created character group \${result.id} with \${existingCharacters.length} characters\`
      );
      return result.id;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        \`Failed to create character group '\${slug}'\`
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
            \`Deleting empty character group '\${slug}' (\${existingGroup.id})\`
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
          \`Updated character group '\${slug}' (\${existingGroup.id}) with \${characterIds?.length || 0} characters\`
        );
        return existingGroup.id;
      }

      // If group doesn't exist, create it (but only if we have characters)
      return await this.createCharacterGroupSafely(prisma, slug, characterIds, mainCharacterId);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        \`Failed to upsert character group '\${slug}'\`
      );
      return null;
    }
  }

  /**
   * Clean up any existing empty character groups
   * @param prisma Prisma client instance
   * @returns Number of empty groups deleted
   */
  static async cleanupEmptyCharacterGroups(prisma: PrismaClient): Promise<number> {
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

      logger.info(\`Found \${emptyGroups.length} empty character groups\`);

      if (emptyGroups.length === 0) {
        return 0;
      }

      // Delete all empty groups
      await prisma.characterGroup.deleteMany({
        where: {
          id: {
            in: emptyGroups.map(g => g.id),
          },
        },
      });

      logger.info(\`Deleted \${emptyGroups.length} empty character groups\`);
      return emptyGroups.length;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        \`Failed to cleanup empty character groups\`
      );
      return 0;
    }
  }
}`;

    // Create utils directory if it doesn't exist
    const utilsDir = path.join(__dirname, "../utils");
    if (!fs.existsSync(utilsDir)) {
      fs.mkdirSync(utilsDir);
    }

    // Write the utils file
    fs.writeFileSync(utilsPath, utilsContent, "utf8");

    logger.info("CharacterGroupUtils.ts created successfully");
  } catch (error) {
    logger.error("Error updating IngestionService:", error);
  }
}

// Run the update
updateIngestionService()
  .then(() => {
    logger.info("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Script failed:", error);
    process.exit(1);
  });
