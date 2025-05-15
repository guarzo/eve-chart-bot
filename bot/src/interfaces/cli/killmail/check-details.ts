#!/usr/bin/env node

import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

const program = new Command();
const prisma = new PrismaClient();

program
  .name("check-details")
  .description("Check killmail details")
  .version("1.0.0");

interface Attacker {
  character_id: number | null;
  corporation_id: number | null;
  alliance_id: number | null;
  damage_done: number;
  final_blow: boolean;
  security_status: number | null;
  ship_type_id: number | null;
  weapon_type_id: number | null;
}

async function checkDetails() {
  try {
    // Get a sample of kills
    const kills = await prisma.killFact.findMany({
      take: 10,
      orderBy: {
        kill_time: "desc",
      },
      include: {
        attackers: true,
        victims: true,
      },
    });

    logger.info(`Found ${kills.length} kills to check`);

    // Check each kill
    for (const kill of kills) {
      try {
        // Get killmail data from ESI
        const response = await fetch(
          `https://zkillboard.com/api/killID/${kill.killmail_id}/`
        );
        const killmailData = await response.json();

        if (!killmailData) {
          logger.warn(`No data found for killmail ${kill.killmail_id}`);
          continue;
        }

        // Check attackers
        if (killmailData.attackers && killmailData.attackers.length > 0) {
          for (const attacker of killmailData.attackers as Attacker[]) {
            const dbAttacker = kill.attackers.find(
              (a) => a.character_id === BigInt(attacker.character_id || 0)
            );

            if (!dbAttacker) {
              logger.warn(
                `Attacker ${attacker.character_id} not found in database for kill ${kill.killmail_id}`
              );
            }
          }
        }

        // Check victim
        if (killmailData.victim) {
          const dbVictim = kill.victims[0];
          if (!dbVictim) {
            logger.warn(
              `Victim not found in database for kill ${kill.killmail_id}`
            );
          }
        }

        logger.info(`Checked killmail ${kill.killmail_id}`);
      } catch (esiError: unknown) {
        if (esiError instanceof Error) {
          logger.error(
            `Error checking killmail ${kill.killmail_id}:`,
            esiError.message
          );
        } else {
          logger.error(
            `Unknown error checking killmail ${kill.killmail_id}:`,
            esiError
          );
        }
      }
    }

    logger.info("Kill details check completed");
    process.exit(0);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error("Error checking kill details:", error.message);
    } else {
      logger.error("Unknown error checking kill details:", error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

program.action(checkDetails);

export default program;
