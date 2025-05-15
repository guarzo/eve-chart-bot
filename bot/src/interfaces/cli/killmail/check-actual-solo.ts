#!/usr/bin/env node

import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

const program = new Command();
const prisma = new PrismaClient();

program
  .name("check-actual-solo")
  .description("Check if kills marked as solo are actually solo")
  .version("1.0.0");

async function checkActualSolo() {
  try {
    // Get all kills marked as solo
    const soloKills = await prisma.killFact.findMany({
      where: {
        solo: true,
      },
      include: {
        attackers: true,
      },
    });

    logger.info(`Found ${soloKills.length} kills marked as solo`);

    // Check each kill
    for (const kill of soloKills) {
      if (kill.attackers.length > 1) {
        logger.warn(
          `Kill ${kill.killmail_id} is marked as solo but has ${kill.attackers.length} attackers`
        );
      }
    }

    logger.info("Solo kill check completed");
    process.exit(0);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error("Error checking solo kills:", error.message);
    } else {
      logger.error("Unknown error checking solo kills:", error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

program.action(checkActualSolo);

export default program;
