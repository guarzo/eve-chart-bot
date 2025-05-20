import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../../lib/logger";

export function registerKillmailCommands(program: Command) {
  const killmailProgram = program
    .command("killmail")
    .description("Killmail management commands");

  // List killmails command
  killmailProgram
    .command("list")
    .description("List recent killmails")
    .option("-c, --character <id>", "Filter by character ID")
    .option("-g, --group <name>", "Filter by group name")
    .option("-l, --limit <number>", "Limit number of results", "10")
    .action(async (options) => {
      try {
        const prisma = new PrismaClient();

        const where = {
          ...(options.character && {
            characters: {
              some: {
                id: parseInt(options.character),
              },
            },
          }),
          ...(options.group && {
            characters: {
              some: {
                groups: {
                  some: {
                    name: options.group,
                  },
                },
              },
            },
          }),
        };

        const killmails = await prisma.killmail.findMany({
          where,
          include: {
            characters: {
              include: {
                groups: true,
              },
            },
          },
          orderBy: {
            killTime: "desc",
          },
          take: parseInt(options.limit),
        });

        if (killmails.length === 0) {
          logger.info("No killmails found");
          return;
        }

        logger.info("Recent killmails:");
        killmails.forEach((kill) => {
          logger.info(`- Killmail ${kill.id} (${kill.killTime})`);
          logger.info(
            `  Characters: ${kill.characters.map((c) => c.name).join(", ")}`
          );
        });

        await prisma.$disconnect();
      } catch (error) {
        logger.error("Error listing killmails:", error);
        process.exit(1);
      }
    });

  // Check killmail ingestion command
  killmailProgram
    .command("check-ingestion")
    .description("Check killmail ingestion status")
    .option("-d, --days <number>", "Number of days to check", "7")
    .action(async (options) => {
      try {
        const prisma = new PrismaClient();
        const days = parseInt(options.days);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        logger.info(`Checking killmail ingestion for the last ${days} days...`);

        const killmails = await prisma.killmail.findMany({
          where: {
            killTime: {
              gte: startDate,
            },
          },
          orderBy: {
            killTime: "desc",
          },
        });

        const totalKills = killmails.length;
        const uniqueCharacters = new Set(
          killmails.flatMap((k) => k.characters.map((c) => c.id))
        ).size;

        logger.info(`Total killmails: ${totalKills}`);
        logger.info(`Unique characters involved: ${uniqueCharacters}`);
        logger.info(`Average kills per day: ${(totalKills / days).toFixed(1)}`);

        await prisma.$disconnect();
      } catch (error) {
        logger.error("Error checking killmail ingestion:", error);
        process.exit(1);
      }
    });
}
