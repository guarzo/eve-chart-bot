import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../../lib/logger";

const prisma = new PrismaClient();

export function registerCharacterCommands(program: Command) {
  const charProgram = program
    .command("character")
    .description("Manage characters");

  // List characters command
  charProgram
    .command("list")
    .description("List all characters")
    .option("-g, --group <name>", "Filter by group name")
    .action(async (options) => {
      try {
        const where = options.group
          ? {
              characterGroup: {
                slug: options.group,
              },
            }
          : undefined;

        const characters = await prisma.character.findMany({
          where,
          include: {
            characterGroup: true,
          },
        });

        logger.info(`Found ${characters.length} characters:`);
        for (const char of characters) {
          logger.info(`- ${char.name} (ID: ${char.eveId})`);
          if (char.characterGroup) {
            logger.info(`  Group: ${char.characterGroup.slug}`);
          }
        }
      } catch (error) {
        logger.error("Error listing characters:", error);
        process.exit(1);
      } finally {
        await prisma.$disconnect();
      }
    });

  // Get character command
  charProgram
    .command("get <id>")
    .description("Get character details")
    .action(async (id) => {
      try {
        const character = await prisma.character.findUnique({
          where: { eveId: id },
          include: {
            characterGroup: true,
          },
        });

        if (!character) {
          logger.error(`Character with ID ${id} not found`);
          process.exit(1);
        }

        logger.info("Character details:");
        logger.info(`- Name: ${character.name}`);
        logger.info(`- ID: ${character.eveId}`);
        logger.info(`- Corporation: ${character.corporationTicker}`);
        if (character.allianceTicker) {
          logger.info(`- Alliance: ${character.allianceTicker}`);
        }
        if (character.characterGroup) {
          logger.info(`- Group: ${character.characterGroup.slug}`);
        }
      } catch (error) {
        logger.error("Error getting character:", error);
        process.exit(1);
      } finally {
        await prisma.$disconnect();
      }
    });

  // List groups command
  charProgram
    .command("groups")
    .description("List all character groups")
    .action(async () => {
      try {
        const groups = await prisma.characterGroup.findMany({
          include: {
            characters: true,
          },
        });

        logger.info(`Found ${groups.length} character groups:`);
        for (const group of groups) {
          const mainChars = group.characters.filter(
            (c) => c.eveId === group.mainCharacterId
          );

          if (mainChars.length === 0) {
            logger.warn(`Group ${group.slug} has no main character assigned`);
          } else if (mainChars.length > 1) {
            logger.warn(
              `Group ${group.slug} has multiple main characters: ${mainChars
                .map((c) => c.name)
                .join(", ")}`
            );
          }

          logger.info(
            `- ${group.slug} (${group.characters.length} characters)`
          );
          for (const char of group.characters) {
            const isMain = char.eveId === group.mainCharacterId;
            logger.info(`  ${char.name}${isMain ? " (main)" : ""}`);
          }
        }
      } catch (error) {
        logger.error("Error listing groups:", error);
        process.exit(1);
      } finally {
        await prisma.$disconnect();
      }
    });
}
