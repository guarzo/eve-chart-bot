import { Command } from "commander";
import { logger } from "../../../lib/logger";
import { RepositoryManager } from "../../../infrastructure/repositories/RepositoryManager";

interface TableInfo {
  table_name: string;
}

async function migrateMapActivity() {
  const repositoryManager = new RepositoryManager();
  const mapActivityRepo = repositoryManager.getMapActivityRepository();

  try {
    logger.info("Starting map activity migration...");

    // Get current tables
    const tables = await mapActivityRepo.executeQuery(async () => {
      return mapActivityRepo.prisma.$queryRaw<TableInfo[]>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'map_activities';
      `;
    });

    // Check if table exists
    const tableExists = tables.length > 0;
    logger.info(`Map activities table exists: ${tableExists}`);

    if (tableExists) {
      // Drop existing table
      logger.info("Dropping existing map_activities table...");
      await mapActivityRepo.executeQuery(async () => {
        await mapActivityRepo.prisma
          .$executeRaw`DROP TABLE IF EXISTS map_activities CASCADE`;
      });
    }

    // Create new table
    logger.info("Creating new map_activities table...");
    await mapActivityRepo.executeQuery(async () => {
      await mapActivityRepo.prisma.$executeRaw`
        CREATE TABLE map_activities (
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
    });

    // Create indexes
    logger.info("Creating indexes...");
    await mapActivityRepo.executeQuery(async () => {
      await mapActivityRepo.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS map_activities_character_id_idx ON map_activities(character_id);
        CREATE INDEX IF NOT EXISTS map_activities_timestamp_idx ON map_activities(timestamp);
        CREATE INDEX IF NOT EXISTS map_activities_alliance_id_idx ON map_activities(alliance_id);
        CREATE INDEX IF NOT EXISTS map_activities_corporation_id_idx ON map_activities(corporation_id);
      `;
    });

    logger.info("Map activity migration complete");
  } catch (error) {
    logger.error("Error migrating map activity:", error);
    process.exit(1);
  } finally {
    await mapActivityRepo.disconnect();
  }
}

const command = new Command("migrate-map-activity")
  .description("Migrate map activity database tables and schema")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (options) => {
    if (!options.force) {
      console.log("WARNING: This will recreate the map_activities table.");
      console.log("Press Ctrl+C to cancel or Enter to continue...");

      // Wait for user input
      await new Promise<void>((resolve) => {
        process.stdin.once("data", () => {
          resolve();
        });
      });
    }

    await migrateMapActivity();
  });

export default command;
