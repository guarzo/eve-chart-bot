import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

interface TableInfo {
  table_name: string;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface ExistsResult {
  exists: boolean;
}

async function migrateMapActivity() {
  const prisma = new PrismaClient();

  try {
    console.log("Starting MapActivity migration...");

    // First verify database connection
    console.log("Verifying database connection...");
    await prisma.$connect();
    console.log("Database connection successful");

    // Begin transaction
    console.log("Starting migration transaction...");
    try {
      await prisma.$transaction(async (tx) => {
        // Drop existing tables one at a time
        console.log("Dropping existing tables...");
        try {
          await tx.$executeRaw`DROP TABLE IF EXISTS map_activities CASCADE;`;
          await tx.$executeRaw`DROP TABLE IF EXISTS map_activities_new CASCADE;`;
          console.log("Tables dropped successfully");
        } catch (error) {
          console.error("Error dropping tables:", error);
          throw error;
        }

        // Create new table
        console.log("Creating new table...");
        try {
          await tx.$executeRaw`
            CREATE TABLE map_activities (
              character_id TEXT NOT NULL,
              timestamp TIMESTAMP(3) NOT NULL,
              signatures INTEGER NOT NULL,
              connections INTEGER NOT NULL,
              passages INTEGER NOT NULL,
              alliance_id INTEGER,
              corporation_id INTEGER NOT NULL
            );
          `;
          console.log("New table created successfully");
        } catch (error) {
          console.error("Error creating new table:", error);
          throw error;
        }

        // Add primary key
        console.log("Adding primary key...");
        try {
          await tx.$executeRaw`
            ALTER TABLE map_activities
            ADD PRIMARY KEY (character_id, timestamp);
          `;
          console.log("Primary key added successfully");
        } catch (error) {
          console.error("Error adding primary key:", error);
          throw error;
        }

        // Add foreign key
        console.log("Adding foreign key...");
        try {
          await tx.$executeRaw`
            ALTER TABLE map_activities
            ADD CONSTRAINT map_activities_character_id_fkey
            FOREIGN KEY (character_id)
            REFERENCES characters(eve_id)
            ON DELETE CASCADE;
          `;
          console.log("Foreign key added successfully");
        } catch (error) {
          console.error("Error adding foreign key:", error);
          throw error;
        }

        // Create indexes one at a time
        console.log("Creating indexes...");
        try {
          await tx.$executeRaw`
            CREATE INDEX IF NOT EXISTS map_activities_character_id_timestamp_idx 
            ON map_activities(character_id, timestamp);
          `;
          await tx.$executeRaw`
            CREATE INDEX IF NOT EXISTS map_activities_corporation_id_timestamp_idx 
            ON map_activities(corporation_id, timestamp);
          `;
          console.log("Indexes created successfully");
        } catch (error) {
          console.error("Error creating indexes:", error);
          throw error;
        }
      });
    } catch (txError) {
      console.error("Transaction failed:", txError);
      throw txError;
    }

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
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
