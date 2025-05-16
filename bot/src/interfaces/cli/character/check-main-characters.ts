#!/usr/bin/env node

import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

const program = new Command();
const prisma = new PrismaClient();

program
  .name("check-main-characters")
  .description("Check main character assignments in groups")
  .version("1.0.0");

async function checkMainCharacters() {
  try {
    logger.info("Checking main character assignments in groups...");

    // Get all character groups with their characters and main character
    const groups = await prisma.characterGroup.findMany({
      include: {
        characters: {
          include: {
            mainCharacter: true,
          },
        },
        mainCharacter: true,
      },
    });

    logger.info(`Found ${groups.length} character groups`);

    // Check each group
    for (const group of groups) {
      logger.info(`\nGroup: ${group.slug} (${group.id})`);
      logger.info(
        `Group's mainCharacterId: ${group.mainCharacterId || "not set"}`
      );

      if (group.mainCharacter) {
        logger.info(
          `Group's main character: ${group.mainCharacter.name} (${group.mainCharacter.eveId})`
        );
      } else {
        logger.warn("Group has no main character assigned");
      }

      logger.info("\nCharacters in group:");
      for (const char of group.characters) {
        logger.info(`- ${char.name} (${char.eveId})`);
        logger.info(`  isMain: ${char.isMain}`);
        logger.info(`  mainCharacterId: ${char.mainCharacterId || "none"}`);
        if (char.mainCharacter) {
          logger.info(
            `  points to main: ${char.mainCharacter.name} (${char.mainCharacter.eveId})`
          );
        }
      }

      // Check for potential issues
      if (group.mainCharacterId && !group.mainCharacter) {
        logger.error(
          `Group has mainCharacterId ${group.mainCharacterId} but main character not found in database`
        );
      }

      if (
        group.mainCharacter &&
        group.mainCharacterId !== group.mainCharacter.eveId
      ) {
        logger.error(
          `Group's mainCharacterId (${group.mainCharacterId}) doesn't match main character's eveId (${group.mainCharacter.eveId})`
        );
      }

      const mainCharacters = group.characters.filter((c) => c.isMain);
      if (mainCharacters.length > 1) {
        logger.warn(
          `Group has multiple characters marked as main: ${mainCharacters
            .map((c) => c.name)
            .join(", ")}`
        );
      }
    }
  } catch (error) {
    logger.error("Error checking main characters:", error);
  } finally {
    await prisma.$disconnect();
  }
}

program.action(checkMainCharacters);

export default program;
