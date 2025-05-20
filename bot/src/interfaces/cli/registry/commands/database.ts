import { Command } from "commander";
import { logger } from "../../../../lib/logger";
import { RepositoryManager } from "../../../../infrastructure/repositories/RepositoryManager";
import { DatabaseUtils } from "../../../../utils/DatabaseUtils";

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
        const repositoryManager = new RepositoryManager();
        const characterRepo = repositoryManager.getCharacterRepository();
        const killRepo = repositoryManager.getKillRepository();
        const mapActivityRepo = repositoryManager.getMapActivityRepository();

        if (!options.force) {
          logger.warn(
            "This will delete all data in the database. Use --force to proceed."
          );
          process.exit(1);
        }

        logger.info("Resetting database...");

        // Use repositories to delete data
        await characterRepo.executeQuery(async () => {
          // Delete all data
          await killRepo.deleteAllKillmails();
          await characterRepo.deleteAllCharacters();
          await characterRepo.deleteAllCharacterGroups();
        });

        logger.info("Database reset complete");
        await characterRepo.disconnect();
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
        const repositoryManager = new RepositoryManager();
        const mapActivityRepo = repositoryManager.getMapActivityRepository();

        logger.info("Starting map activity migration...");

        // Add your map activity migration logic here
        await mapActivityRepo.executeQuery(async () => {
          // Create table if it doesn't exist
          await mapActivityRepo.prisma.$executeRaw`
            CREATE TABLE IF NOT EXISTS map_activities (
              id SERIAL PRIMARY KEY,
              character_id BIGINT NOT NULL,
              timestamp TIMESTAMP NOT NULL,
              signatures INTEGER NOT NULL DEFAULT 0,
              connections INTEGER NOT NULL DEFAULT 0,
              passages INTEGER NOT NULL DEFAULT 0,
              alliance_id BIGINT,
              corporation_id BIGINT,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `;

          // Create indexes
          await mapActivityRepo.prisma.$executeRaw`
            CREATE INDEX IF NOT EXISTS map_activities_character_id_idx ON map_activities(character_id);
            CREATE INDEX IF NOT EXISTS map_activities_timestamp_idx ON map_activities(timestamp);
            CREATE INDEX IF NOT EXISTS map_activities_alliance_id_idx ON map_activities(alliance_id);
            CREATE INDEX IF NOT EXISTS map_activities_corporation_id_idx ON map_activities(corporation_id);
          `;
        });

        logger.info("Map activity migration complete");
        await mapActivityRepo.disconnect();
      } catch (error) {
        logger.error("Error migrating map activity:", error);
        process.exit(1);
      }
    });
}
