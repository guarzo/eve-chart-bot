import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../../lib/logger";

export function registerDatabaseCommands(program: Command) {
  const dbProgram = program
    .command("db")
    .description("Database management commands");

  // Reset database command
  dbProgram
    .command("reset")
    .description("Reset the database to a clean state")
    .option("-f, --force", "Force reset without confirmation")
    .action(async (options) => {
      try {
        const prisma = new PrismaClient();

        if (!options.force) {
          logger.warn(
            "This will delete all data in the database. Use --force to proceed."
          );
          process.exit(1);
        }

        logger.info("Resetting database...");
        await prisma.$executeRaw`TRUNCATE TABLE "Killmail" CASCADE`;
        await prisma.$executeRaw`TRUNCATE TABLE "Character" CASCADE`;
        await prisma.$executeRaw`TRUNCATE TABLE "CharacterGroup" CASCADE`;
        await prisma.$executeRaw`TRUNCATE TABLE "MapActivity" CASCADE`;

        logger.info("Database reset complete");
        await prisma.$disconnect();
      } catch (error) {
        logger.error("Error resetting database:", error);
        process.exit(1);
      }
    });

  // Migrate database command
  dbProgram
    .command("migrate")
    .description("Run database migrations")
    .option("--reset", "Reset the database before migrating")
    .action(async (options) => {
      try {
        const { execSync } = require("child_process");

        if (options.reset) {
          logger.info("Resetting database before migration...");
          execSync("npx prisma migrate reset --force", { stdio: "inherit" });
        } else {
          logger.info("Running database migrations...");
          execSync("npx prisma migrate deploy", { stdio: "inherit" });
        }

        logger.info("Database migration complete");
      } catch (error) {
        logger.error("Error running migrations:", error);
        process.exit(1);
      }
    });

  // Migrate map activity command
  dbProgram
    .command("migrate-map-activity")
    .description("Migrate map activity data")
    .action(async () => {
      try {
        const prisma = new PrismaClient();
        logger.info("Starting map activity migration...");

        // Add your map activity migration logic here

        logger.info("Map activity migration complete");
        await prisma.$disconnect();
      } catch (error) {
        logger.error("Error migrating map activity:", error);
        process.exit(1);
      }
    });
}
