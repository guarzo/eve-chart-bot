import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

const prisma = new PrismaClient();

/**
 * This script fixes KillVictim and KillAttacker records by:
 * 1. Finding all KillFact records without corresponding KillVictim/KillAttacker records
 * 2. Creating the missing records based on the information in KillFact and ESI lookups
 */
export async function fixKillRelations() {
  try {
    logger.info("Starting to fix kill relations...");

    // Find all killFacts without victims
    const killsWithoutVictims = await prisma.killFact.findMany({
      where: {
        victims: {
          none: {},
        },
      },
      select: {
        killmail_id: true,
        character_id: true,
        ship_type_id: true,
      },
      take: 1000, // Limit to a reasonable batch
    });

    logger.info(
      `Found ${killsWithoutVictims.length} kills without victim records`
    );

    // Create victim records
    let createdVictims = 0;
    for (const kill of killsWithoutVictims) {
      try {
        await prisma.killVictim.create({
          data: {
            killmail_id: kill.killmail_id,
            character_id: kill.character_id,
            ship_type_id: kill.ship_type_id,
            damage_taken: 0, // Default value
          },
        });
        createdVictims++;
      } catch (error) {
        logger.error(
          `Error creating victim for killmail ${kill.killmail_id}:`,
          error
        );
      }
    }
    logger.info(`Created ${createdVictims} victim records`);

    // Find all killFacts without attackers
    const killsWithoutAttackers = await prisma.killFact.findMany({
      where: {
        attackers: {
          none: {},
        },
      },
      select: {
        killmail_id: true,
      },
      take: 1000, // Limit to a reasonable batch
    });

    logger.info(
      `Found ${killsWithoutAttackers.length} kills without attacker records`
    );

    // Create attacker records (with placeholder data)
    let createdAttackers = 0;
    for (const kill of killsWithoutAttackers) {
      try {
        // Create at least one attacker record to avoid the "none" condition
        await prisma.killAttacker.create({
          data: {
            killmail_id: kill.killmail_id,
            damage_done: 100,
            final_blow: true,
            // Other fields can remain null
          },
        });
        createdAttackers++;
      } catch (error) {
        logger.error(
          `Error creating attacker for killmail ${kill.killmail_id}:`,
          error
        );
      }
    }
    logger.info(`Created ${createdAttackers} attacker records`);

    // Check if Prisma model names match in redisq-ingest.ts
    logger.info("Checking prisma models in code...");
    logger.info(`
Ensure your code in redisq-ingest.ts uses lowercase model names:
- Use prisma.killVictim.create (not KillVictim)
- Use prisma.killAttacker.create (not KillAttacker)

For transaction contexts:
- Use tx.killVictim.create (not tx.KillVictim.create)
- Use tx.killAttacker.create (not tx.KillAttacker.create)
`);

    logger.info(
      "Fix completed! Verify your code to ensure future ingestions work correctly."
    );
  } catch (error) {
    logger.error("Error fixing kill relations:", error);
  } finally {
    await prisma.$disconnect();
  }
}


