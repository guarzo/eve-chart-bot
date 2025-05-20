import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../../lib/logger";

export function registerCharacterCommands(program: Command) {
  const charProgram = program
    .command("character")
    .description("Character management commands");

  // List characters command
  charProgram
    .command("list")
    .description("List all characters")
    .option("-g, --group <group>", "Filter by group name")
    .action(async (options) => {
      try {
        const prisma = new PrismaClient();

        const where = options.group
          ? {
              groups: {
                some: {
                  name: options.group,
                },
              },
            }
          : {};

        const characters = await prisma.character.findMany({
          where,
          include: {
            groups: true,
          },
        });

        if (characters.length === 0) {
          logger.info("No characters found");
          return;
        }

        logger.info("Characters:");
        characters.forEach((char) => {
          logger.info(`- ${char.name} (ID: ${char.id})`);
          if (char.groups.length > 0) {
            logger.info(
              `  Groups: ${char.groups.map((g) => g.name).join(", ")}`
            );
          }
        });

        await prisma.$disconnect();
      } catch (error) {
        logger.error("Error listing characters:", error);
        process.exit(1);
      }
    });

  // Remove character command
  charProgram
    .command("remove <id>")
    .description("Remove a character by ID")
    .option("-f, --force", "Force removal without confirmation")
    .action(async (id: string, options) => {
      try {
        const prisma = new PrismaClient();

        if (!options.force) {
          logger.warn(
            "This will remove the character and all associated data. Use --force to proceed."
          );
          process.exit(1);
        }

        logger.info(`Removing character ${id}...`);
        await prisma.character.delete({
          where: { id: parseInt(id) },
        });

        logger.info("Character removed successfully");
        await prisma.$disconnect();
      } catch (error) {
        logger.error("Error removing character:", error);
        process.exit(1);
      }
    });

  // Check main characters command
  charProgram
    .command("check-main")
    .description("Check main character assignments")
    .action(async () => {
      try {
        const prisma = new PrismaClient();
        logger.info("Checking main character assignments...");

        const groups = await prisma.characterGroup.findMany({
          include: {
            characters: true,
          },
        });

        for (const group of groups) {
          const mainChars = group.characters.filter((c) => c.isMain);
          if (mainChars.length === 0) {
            logger.warn(`Group ${group.name} has no main character assigned`);
          } else if (mainChars.length > 1) {
            logger.warn(
              `Group ${group.name} has multiple main characters: ${mainChars
                .map((c) => c.name)
                .join(", ")}`
            );
          }
        }

        logger.info("Main character check complete");
        await prisma.$disconnect();
      } catch (error) {
        logger.error("Error checking main characters:", error);
        process.exit(1);
      }
    });
}
