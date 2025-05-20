import { Command } from "commander";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../../../lib/logger";
import { RepositoryManager } from "../../../infrastructure/repositories/RepositoryManager";

const execAsync = promisify(exec);

async function runMigration() {
  const repositoryManager = new RepositoryManager();
  const characterRepo = repositoryManager.getCharacterRepository();

  try {
    logger.info("Starting database migration...");

    // 1. Reset database and apply new schema
    logger.info("Resetting database and applying new schema...");
    const { stdout, stderr } = await execAsync(
      "npx prisma db push --force-reset"
    );
    console.log("Schema reset output:", stdout);
    if (stderr) {
      console.error("Schema reset errors:", stderr);
    }

    // 2. Generate Prisma Client
    logger.info("Generating Prisma Client...");
    const { stdout: genStdout, stderr: genStderr } = await execAsync(
      "npx prisma generate"
    );
    console.log("Client generation output:", genStdout);
    if (genStderr) {
      console.error("Client generation errors:", genStderr);
    }

    // 3. Verify schema changes
    logger.info("Verifying schema changes...");
    const tables = await characterRepo.executeQuery(async () => {
      return characterRepo.prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
    });
    console.log("Current database tables:", tables);

    // 4. Create indexes one by one
    logger.info("Creating indexes...");
    // Add index creation logic here

    logger.info("Database migration complete");
  } catch (error) {
    logger.error("Error running migration:", error);
    process.exit(1);
  } finally {
    await characterRepo.disconnect();
  }
}

const command = new Command("migrate-db")
  .description("Run database migrations, reset schema, and create indexes")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (options) => {
    if (!options.force) {
      console.log(
        "WARNING: This will reset your database and apply migrations."
      );
      console.log("Press Ctrl+C to cancel or Enter to continue...");

      // Wait for user input
      await new Promise<void>((resolve) => {
        process.stdin.once("data", () => {
          resolve();
        });
      });
    }

    await runMigration();
  });

export default command;
