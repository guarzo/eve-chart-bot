import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

const command = new Command("reset")
  .description(
    "Reset the database by dropping all tables and reapplying the schema"
  )
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (options) => {
    if (!options.force) {
      console.log("WARNING: This will delete all data in the database.");
      console.log("Press Ctrl+C to cancel or Enter to continue...");

      // Wait for user input
      await new Promise<void>((resolve) => {
        process.stdin.once("data", () => {
          resolve();
        });
      });
    }

    try {
      console.log("Starting database reset...");

      // 1. Drop all tables
      console.log("Dropping all tables...");
      await prisma.$executeRaw`DROP SCHEMA public CASCADE`;
      await prisma.$executeRaw`CREATE SCHEMA public`;

      // 2. Apply new schema
      console.log("Applying new schema...");
      await execAsync("npx prisma db push");

      // 3. Generate Prisma Client
      console.log("Generating Prisma Client...");
      await execAsync("npx prisma generate");

      console.log("Database reset complete!");
    } catch (error) {
      console.error("Error resetting database:", error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

export default command;
