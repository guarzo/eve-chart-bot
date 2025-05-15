#!/usr/bin/env node

import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

const program = new Command();
const prisma = new PrismaClient();

program.name("fix-solo").description("Fix solo kill flags").version("1.0.0");

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

async function fixSolo() {
  try {
    // Get all kills
    const kills = await prisma.killFact.findMany({
      include: {
        attackers: true,
      },
    });

    logger.info(`Found ${kills.length} kills to check`);

    // Check each kill
    for (const kill of kills) {
      const isSolo = kill.attackers.length === 1;

      if (kill.solo !== isSolo) {
        await prisma.killFact.update({
          where: { killmail_id: kill.killmail_id },
          data: { solo: isSolo },
        });

        logger.info(
          `Updated kill ${kill.killmail_id} solo flag to ${isSolo} (${kill.attackers.length} attackers)`
        );
      }
    }

    logger.info("Solo kill flags fixed");
    process.exit(0);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error("Error fixing solo kills:", error.message);
    } else {
      logger.error("Unknown error fixing solo kills:", error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

program.action(fixSolo);

export default program;
