#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";
import { IngestionService } from "../../../services/IngestionService";
import { config } from "dotenv";
import { join } from "path";
import axios from "axios";
import { Command } from "commander";

// Load environment variables
config({ path: join(__dirname, "../../.env") });

const program = new Command();
const prisma = new PrismaClient();

program
  .name("backfill-kill-relations")
  .description("Backfill kill relations")
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

/**
 * This script backfills KillAttacker and KillVictim records for existing KillFact records.
 */
async function backfillKillRelations() {
  try {
    // Get all kills without relations
    const kills = await prisma.killFact.findMany({
      where: {
        attackers: {
          none: {},
        },
      },
    });

    logger.info(`Found ${kills.length} kills without relations`);

    // Process each kill
    for (const kill of kills) {
      // Get killmail data from ESI
      const killmailData = await fetch(
        `https://zkillboard.com/api/killID/${kill.killmail_id}/`
      ).then((res) => res.json());

      if (!killmailData) {
        logger.warn(`No data found for killmail ${kill.killmail_id}`);
        continue;
      }

      // Create attacker records
      if (killmailData.attackers && killmailData.attackers.length > 0) {
        for (const attacker of killmailData.attackers as Attacker[]) {
          await prisma.killAttacker.create({
            data: {
              killmail_id: kill.killmail_id,
              character_id: attacker.character_id
                ? BigInt(attacker.character_id)
                : null,
              corporation_id: attacker.corporation_id
                ? BigInt(attacker.corporation_id)
                : null,
              alliance_id: attacker.alliance_id
                ? BigInt(attacker.alliance_id)
                : null,
              damage_done: attacker.damage_done,
              final_blow: attacker.final_blow,
              security_status: attacker.security_status,
              ship_type_id: attacker.ship_type_id,
              weapon_type_id: attacker.weapon_type_id,
            },
          });
        }
      }

      logger.info(`Processed killmail ${kill.killmail_id}`);
    }

    logger.info("Kill relations backfill completed");
    process.exit(0);
  } catch (error) {
    logger.error("Error backfilling kill relations:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

program.action(backfillKillRelations);

export default program;
