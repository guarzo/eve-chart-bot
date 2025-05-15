import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { logger } from "../../../lib/logger";

// Load environment variables
config();

const prisma = new PrismaClient();

/**
 * Create default character groups from existing characters
 */
async function createDefaultGroups() {
  try {
    // Check if any groups already exist
    const existingGroups = await prisma.characterGroup.findMany();
    if (existingGroups.length > 0) {
      logger.info(
        `Found ${existingGroups.length} existing character groups, no need to create defaults`
      );

      // List existing groups
      existingGroups.forEach((group) => {
        logger.info(`Group: id=${group.id}, slug=${group.slug}`);
      });

      return;
    }

    logger.info(
      "No character groups found, creating defaults based on corporations"
    );

    // Get all unique corporations from characters
    const characters = await prisma.character.findMany();
    logger.info(`Found ${characters.length} characters`);

    if (characters.length === 0) {
      logger.warn("No characters found in database, cannot create groups");
      return;
    }

    // Group characters by corporation
    const corpGroups = new Map<number, Array<(typeof characters)[0]>>();
    characters.forEach((char) => {
      if (!corpGroups.has(char.corporationId)) {
        corpGroups.set(char.corporationId, []);
      }
      corpGroups.get(char.corporationId)!.push(char);
    });

    logger.info(`Creating ${corpGroups.size} corporation-based groups`);

    // Create a group for each corporation
    for (const [corpId, corpChars] of corpGroups.entries()) {
      const corpTicker = corpChars[0].corporationTicker || "CORP";
      const groupSlug = `corp-${corpTicker}-${corpId}`;

      // Find a main character (prefer main characters, otherwise use first)
      const mainChar = corpChars.find((c) => c.isMain) || corpChars[0];

      logger.info(
        `Creating group for corporation ${corpTicker} with ${corpChars.length} characters`
      );

      // Create the group
      const group = await prisma.characterGroup.create({
        data: {
          slug: groupSlug,
          mainCharacterId: mainChar.eveId,
        },
      });

      // Update characters to belong to this group
      await Promise.all(
        corpChars.map((char) =>
          prisma.character.update({
            where: { eveId: char.eveId },
            data: { characterGroupId: group.id },
          })
        )
      );

      logger.info(
        `Created group ${group.slug} (${group.id}) with main character ${mainChar.name}`
      );
    }

    // Create an "All" group only if we have characters to assign to it
    const allCharacters = await prisma.character.findMany();
    if (allCharacters.length > 0) {
      // Find a main character for the all group (prefer main characters)
      const allGroupMain =
        allCharacters.find((c) => c.isMain) || allCharacters[0];

      const allGroup = await prisma.characterGroup.create({
        data: {
          slug: "all-characters",
          mainCharacterId: allGroupMain.eveId,
        },
      });

      logger.info(
        `Created "All Characters" group with ${allCharacters.length} characters and main character ${allGroupMain.name}`
      );
    } else {
      logger.warn(
        "No characters found, skipping creation of 'all-characters' group"
      );
    }

    logger.info("Successfully created default character groups");
  } catch (error) {
    logger.error("Error creating default character groups:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
createDefaultGroups().catch((error) => {
  logger.error("Script failed:", error);
  process.exit(1);
});
