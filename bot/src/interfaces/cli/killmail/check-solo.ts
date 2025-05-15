import { Command } from "commander";
import { PrismaClient } from "@prisma/client";

async function checkSoloKills(sampleSize: number) {
  const prisma = new PrismaClient();

  try {
    console.log("Checking for solo kills in the database...");

    // Count total kills
    const totalKills = await prisma.killFact.count();
    console.log(`Total kills in database: ${totalKills}`);

    // Count solo kills (where solo = true)
    const soloKills = await prisma.killFact.count({
      where: {
        solo: true,
      },
    });
    console.log(`Solo kills in database (solo = true): ${soloKills}`);

    // Print percentage
    const percentage = totalKills > 0 ? (soloKills / totalKills) * 100 : 0;
    console.log(`Solo kills percentage: ${percentage.toFixed(2)}%`);

    // Sample some solo kills
    const sampleSoloKills = await prisma.killFact.findMany({
      where: {
        solo: true,
      },
      take: sampleSize,
      orderBy: {
        kill_time: "desc",
      },
    });

    console.log(`\nSample of ${sampleSize} recent solo kills:`);
    sampleSoloKills.forEach((kill) => {
      console.log(
        `Killmail ID: ${kill.killmail_id}, Character ID: ${kill.character_id}, Time: ${kill.kill_time}`
      );
    });

    // Check for character groups with solo kills
    const characterGroups = await prisma.characterGroup.findMany({
      include: {
        characters: true,
      },
    });

    console.log("\nSolo kills by character group:");
    for (const group of characterGroups) {
      const characterIds = group.characters.map((char) => BigInt(char.eveId));

      if (characterIds.length === 0) continue;

      const groupSoloKills = await prisma.killFact.count({
        where: {
          character_id: {
            in: characterIds,
          },
          solo: true,
        },
      });

      console.log(
        `Group ${group.id} (${group.slug}): ${groupSoloKills} solo kills`
      );
    }
  } catch (error) {
    console.error("Error checking solo kills:", error);
  } finally {
    await prisma.$disconnect();
  }
}

const command = new Command("check-solo")
  .description("Check and analyze solo kills in the database")
  .option("-s, --sample <number>", "Number of recent solo kills to sample", "5")
  .action(async (options) => {
    const sampleSize = parseInt(options.sample, 10);

    if (isNaN(sampleSize) || sampleSize <= 0) {
      console.error("Error: sample size must be a positive number");
      return;
    }

    await checkSoloKills(sampleSize);
  });

export default command;
