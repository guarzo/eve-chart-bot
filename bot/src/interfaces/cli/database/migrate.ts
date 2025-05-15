import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../../../lib/logger";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function runMigration() {
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
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log("Current database tables:", tables);

    // 4. Create indexes one by one
    logger.info("Creating indexes...");
    const indexes = [
      'CREATE INDEX IF NOT EXISTS "KillFact_killTime_idx" ON "KillFact"("killTime")',
      'CREATE INDEX IF NOT EXISTS "KillFact_systemId_idx" ON "KillFact"("systemId")',
      'CREATE INDEX IF NOT EXISTS "KillVictim_characterId_idx" ON "KillVictim"("characterId")',
      'CREATE INDEX IF NOT EXISTS "KillVictim_corporationId_idx" ON "KillVictim"("corporationId")',
      'CREATE INDEX IF NOT EXISTS "KillVictim_allianceId_idx" ON "KillVictim"("allianceId")',
      'CREATE INDEX IF NOT EXISTS "KillAttacker_characterId_idx" ON "KillAttacker"("characterId")',
      'CREATE INDEX IF NOT EXISTS "KillAttacker_corporationId_idx" ON "KillAttacker"("corporationId")',
      'CREATE INDEX IF NOT EXISTS "KillAttacker_allianceId_idx" ON "KillAttacker"("allianceId")',
      'CREATE INDEX IF NOT EXISTS "KillCharacter_characterId_idx" ON "KillCharacter"("characterId")',
    ];

    for (const index of indexes) {
      try {
        await prisma.$executeRawUnsafe(index);
        console.log(`Created index: ${index}`);
      } catch (error) {
        console.error(`Failed to create index: ${index}`, error);
      }
    }

    logger.info("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed with error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
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
