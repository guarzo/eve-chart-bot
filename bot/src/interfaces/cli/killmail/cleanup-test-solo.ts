import { Command } from "commander";
import { PrismaClient } from "@prisma/client";

async function cleanupTestSoloKills() {
  const prisma = new PrismaClient();

  try {
    console.log("Cleaning up test solo kills...");

    // Count solo kills before cleanup
    const beforeCount = await prisma.killFact.count({
      where: {
        solo: true,
      },
    });

    console.log(`Found ${beforeCount} solo kills to reset`);

    // Reset all solo kills to false
    const result = await prisma.killFact.updateMany({
      where: {
        solo: true,
      },
      data: {
        solo: false,
      },
    });

    console.log(`Reset ${result.count} test solo kills back to solo=false`);

    // Verify the cleanup
    const afterCount = await prisma.killFact.count({
      where: {
        solo: true,
      },
    });

    console.log(`Remaining solo kills in database: ${afterCount}`);
  } catch (error) {
    console.error("Error cleaning up test solo kills:", error);
  } finally {
    await prisma.$disconnect();
  }
}

const command = new Command("cleanup-test-solo")
  .description("Reset all solo kills back to solo=false in the database")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (options) => {
    if (!options.force) {
      console.log(
        "WARNING: This will reset ALL solo kills in the database to solo=false."
      );
      console.log("Press Ctrl+C to cancel or Enter to continue...");

      // Wait for user input
      await new Promise<void>((resolve) => {
        process.stdin.once("data", () => {
          resolve();
        });
      });
    }

    await cleanupTestSoloKills();
  });

export default command;
