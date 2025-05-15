#!/usr/bin/env node

import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

const program = new Command();
const prisma = new PrismaClient();

program
  .name("check-character-group-assignments")
  .description("Check character group assignments")
  .version("1.0.0");

async function checkCharacterGroupAssignments() {
  try {
    // Get all character groups
    const groups = await prisma.characterGroup.findMany({
      include: {
        mainCharacter: true,
        characters: true,
      },
    });

    logger.info(`Found ${groups.length} character groups`);

    // Check each group
    for (const group of groups) {
      logger.info(`\nChecking group: ${group.slug}`);
      logger.info(`Main character: ${group.mainCharacter?.name || "None"}`);
      logger.info(`Total characters: ${group.characters.length}`);

      // Check for characters without a group
      const ungroupedCharacters = await prisma.character.findMany({
        where: {
          characterGroupId: null,
        },
      });

      if (ungroupedCharacters.length > 0) {
        logger.info(
          `\nFound ${ungroupedCharacters.length} ungrouped characters:`
        );
        for (const character of ungroupedCharacters) {
          logger.info(`- ${character.name} (${character.eveId})`);
        }
      }
    }

    process.exit(0);
  } catch (error) {
    logger.error("Error checking character group assignments:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

program.action(checkCharacterGroupAssignments);

export default program;
