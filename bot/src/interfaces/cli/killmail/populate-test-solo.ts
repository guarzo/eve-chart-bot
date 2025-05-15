import { Command } from "commander";
import { PrismaClient } from "@prisma/client";

async function populateTestSoloKills(count: number, percentage: number) {
  const prisma = new PrismaClient();

  try {
    console.log("Setting solo flag for some existing kills...");

    // Get some recent kills to update
    const recentKills = await prisma.killFact.findMany({
      orderBy: {
        kill_time: "desc",
      },
      take: count,
    });

    if (recentKills.length === 0) {
      console.log("No kills found to update.");
      return;
    }

    console.log(`Found ${recentKills.length} kills to potentially update.`);

    // Calculate how many kills to mark as solo based on percentage
    const divisor = Math.floor(100 / percentage);
    const killsToUpdate = recentKills.filter(
      (_, index) => index % divisor === 0
    );

    console.log(
      `Marking ${killsToUpdate.length} kills as solo kills (${percentage}%)...`
    );

    // Update each kill to set solo = true
    let updatedCount = 0;
    for (const kill of killsToUpdate) {
      await prisma.killFact.update({
        where: {
          killmail_id: kill.killmail_id,
        },
        data: {
          solo: true,
        },
      });
      updatedCount++;

      if (updatedCount % 10 === 0) {
        console.log(`Updated ${updatedCount}/${killsToUpdate.length} kills`);
      }
    }

    console.log(
      `Successfully updated ${updatedCount} kills to be marked as solo kills.`
    );

    // Now verify the update
    const soloKillsCount = await prisma.killFact.count({
      where: {
        solo: true,
      },
    });

    console.log(`Total solo kills in database after update: ${soloKillsCount}`);
  } catch (error) {
    console.error("Error updating solo kills:", error);
  } finally {
    await prisma.$disconnect();
  }
}

const command = new Command("populate-test-solo")
  .description(
    "Populate the database with test solo kills by marking existing kills"
  )
  .option("-c, --count <number>", "Number of recent kills to consider", "100")
  .option(
    "-p, --percentage <number>",
    "Percentage of kills to mark as solo",
    "30"
  )
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (options) => {
    const count = parseInt(options.count, 10);
    const percentage = parseInt(options.percentage, 10);

    if (isNaN(count) || count <= 0) {
      console.error("Error: count must be a positive number");
      return;
    }

    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      console.error("Error: percentage must be between 1 and 100");
      return;
    }

    if (!options.force) {
      console.log(
        `WARNING: This will mark approximately ${percentage}% of the ${count} most recent kills as solo kills.`
      );
      console.log("Press Ctrl+C to cancel or Enter to continue...");

      // Wait for user input
      await new Promise<void>((resolve) => {
        process.stdin.once("data", () => {
          resolve();
        });
      });
    }

    await populateTestSoloKills(count, percentage);
  });

export default command;
