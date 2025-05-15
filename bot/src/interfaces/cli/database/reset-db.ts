import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";
import * as readline from "readline";

/**
 * Reset the database (delete all data)
 * @param force If true, skip confirmation prompt
 */
export async function resetDatabase(force = false): Promise<void> {
  const prisma = new PrismaClient();

  try {
    if (!force) {
      const confirmed = await promptForConfirmation(
        "WARNING: This will DELETE ALL DATA from the database. Are you sure? (y/N)"
      );
      if (!confirmed) {
        logger.info("Database reset canceled");
        return;
      }
    }

    logger.info("Resetting database...");

    // Delete all records from tables in a specific order to avoid foreign key constraints
    await prisma.killAttacker.deleteMany();
    await prisma.killVictim.deleteMany();
    await prisma.killFact.deleteMany();
    await prisma.lossFact.deleteMany();
    await prisma.mapActivity.deleteMany();
    await prisma.character.deleteMany();
    await prisma.characterGroup.deleteMany();

    logger.info("Database reset complete");
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Error resetting database"
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Prompt the user for confirmation
 * @param question The question to ask
 * @returns True if confirmed, false otherwise
 */
function promptForConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

// If this file is being executed directly, run the reset
if (require.main === module) {
  resetDatabase();
}
