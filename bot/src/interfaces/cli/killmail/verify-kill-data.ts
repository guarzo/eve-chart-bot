import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

/**
 * This script verifies that kill data is being recorded correctly in all tables.
 */
export async function verifyKillData() {
  const prisma = new PrismaClient();

  try {
    logger.info("Verifying kill data in the database");

    // Get counts of records in each table
    const killFactCount = await prisma.killFact.count();
    const killAttackerCount = await prisma.killAttacker.count();
    const killVictimCount = await prisma.killVictim.count();
    const lossFactCount = await prisma.lossFact.count();

    logger.info(`KillFact records: ${killFactCount}`);
    logger.info(`KillAttacker records: ${killAttackerCount}`);
    logger.info(`KillVictim records: ${killVictimCount}`);
    logger.info(`LossFact records: ${lossFactCount}`);

    // Check for kills that have no attackers or victims
    const killsWithoutAttackers = await prisma.killFact.findMany({
      where: {
        attackers: {
          none: {},
        },
      },
      take: 10,
    });

    logger.info(`Kills without attackers: ${killsWithoutAttackers.length}`);
    if (killsWithoutAttackers.length > 0) {
      logger.info("Sample of kills without attackers:");
      for (const kill of killsWithoutAttackers.slice(0, 5)) {
        logger.info(`  Kill ID: ${kill.killmail_id} at ${kill.kill_time}`);
      }
    }

    const killsWithoutVictims = await prisma.killFact.findMany({
      where: {
        victims: {
          none: {},
        },
      },
      take: 10,
    });

    logger.info(`Kills without victims: ${killsWithoutVictims.length}`);
    if (killsWithoutVictims.length > 0) {
      logger.info("Sample of kills without victims:");
      for (const kill of killsWithoutVictims.slice(0, 5)) {
        logger.info(`  Kill ID: ${kill.killmail_id} at ${kill.kill_time}`);
      }
    }

    // Check for a sample of kills with full data
    const completeKills = await prisma.killFact.findMany({
      where: {
        attackers: {
          some: {},
        },
        victims: {
          some: {},
        },
      },
      include: {
        attackers: true,
        victims: true,
      },
      take: 5,
      orderBy: {
        kill_time: "desc",
      },
    });

    if (completeKills.length > 0) {
      logger.info("Sample of complete kills:");
      for (const kill of completeKills) {
        logger.info(
          `  Kill ID: ${kill.killmail_id}, ${kill.attackers.length} attackers, ${kill.victims.length} victims`
        );
        if (kill.attackers.length > 0) {
          const attacker = kill.attackers[0];
          logger.info(
            `    Sample attacker: ID ${
              attacker.character_id || "NPC"
            }, damage done: ${attacker.damage_done}`
          );
        }
        if (kill.victims.length > 0) {
          const victim = kill.victims[0];
          logger.info(
            `    Victim: ID ${victim.character_id || "NPC"}, ship type: ${
              victim.ship_type_id
            }`
          );
        }
      }
    } else {
      logger.warn("No complete kills found with both attackers and victims");
    }

    // If there are issues, suggest running a backfill
    if (
      killsWithoutAttackers.length > 0 ||
      killsWithoutVictims.length > 0 ||
      completeKills.length === 0
    ) {
      logger.warn(
        "Some kills are missing attacker or victim data. Consider running a backfill script to fix this."
      );
    } else {
      logger.info("All kill data appears to be correctly recorded!");
    }
  } catch (error) {
    logger.error("Error verifying kill data:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}


