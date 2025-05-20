import { logger } from "../../../lib/logger";
import * as readline from "readline";
import { RepositoryManager } from "../../../infrastructure/repositories/RepositoryManager";

/**
 * Reset the database (delete all data)
 * @param force If true, skip confirmation prompt
 */
export async function resetDatabase(force = false): Promise<void> {
  const repositoryManager = new RepositoryManager();
  const characterRepo = repositoryManager.getCharacterRepository();
  const killRepo = repositoryManager.getKillRepository();
  const mapActivityRepo = repositoryManager.getMapActivityRepository();

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
    await characterRepo.executeQuery(async () => {
      await characterRepo.prisma.killAttacker.deleteMany();
      await characterRepo.prisma.killVictim.deleteMany();
      await characterRepo.prisma.killFact.deleteMany();
      await characterRepo.prisma.lossFact.deleteMany();
      await characterRepo.prisma.mapActivity.deleteMany();
      await characterRepo.prisma.character.deleteMany();
      await characterRepo.prisma.characterGroup.deleteMany();
    });

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
    await characterRepo.disconnect();
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
