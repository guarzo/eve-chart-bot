#!/usr/bin/env node

import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

const program = new Command();
const prisma = new PrismaClient();

program
  .name("fix-character-groups")
  .description("Fix character group assignments")
  .version("1.0.0");

async function fixCharacterGroups() {
  try {
    // Get all characters without a group
    const ungroupedCharacters = await prisma.character.findMany({
      where: {
        characterGroupId: null,
      },
    });

    logger.info(`Found ${ungroupedCharacters.length} ungrouped characters`);

    // Process each ungrouped character
    for (const character of ungroupedCharacters) {
      // Find existing group with matching corporation
      const existingGroup = await prisma.characterGroup.findFirst({
        where: {
          characters: {
            some: {
              corporationId: character.corporationId,
            },
          },
        },
      });

      if (existingGroup) {
        // Add character to existing group
        await prisma.character.update({
          where: { eveId: character.eveId },
          data: { characterGroupId: existingGroup.id },
        });
        logger.info(
          `Added ${character.name} to existing group ${existingGroup.slug}`
        );
      } else {
        // Create new group
        const newGroup = await prisma.characterGroup.create({
          data: {
            slug: `${character.corporationTicker.toLowerCase()}-${Date.now()}`,
            mainCharacterId: character.eveId,
          },
        });

        // Add character to new group
        await prisma.character.update({
          where: { eveId: character.eveId },
          data: { characterGroupId: newGroup.id },
        });

        logger.info(`Created new group ${newGroup.slug} for ${character.name}`);
      }
    }

    logger.info("Character group assignments fixed");
    process.exit(0);
  } catch (error) {
    logger.error("Error fixing character groups:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

program.action(fixCharacterGroups);

export default program;
