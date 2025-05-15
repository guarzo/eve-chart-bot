#!/usr/bin/env node

import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

const program = new Command();
const prisma = new PrismaClient();

program
  .name("populate-relations")
  .description("Populate kill relations")
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

interface Victim {
  character_id: number | null;
  corporation_id: number | null;
  alliance_id: number | null;
  damage_taken: number;
  ship_type_id: number;
}

async function populateRelations() {
  try {
    // Get all kills without relations
    const kills = await prisma.killFact.findMany({
      where: {
        OR: [
          {
            attackers: {
              none: {},
            },
          },
          {
            victims: {
              none: {},
            },
          },
        ],
      },
    });

    logger.info(`Found ${kills.length} kills without relations`);

    // Process each kill
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

        // Create victim record
        if (killmailData.victim) {
          const victim = killmailData.victim as Victim;
          await prisma.killVictim.create({
            data: {
              killmail_id: kill.killmail_id,
              character_id: victim.character_id
                ? BigInt(victim.character_id)
                : null,
              corporation_id: victim.corporation_id
                ? BigInt(victim.corporation_id)
                : null,
              alliance_id: victim.alliance_id
                ? BigInt(victim.alliance_id)
                : null,
              damage_taken: victim.damage_taken,
              ship_type_id: victim.ship_type_id,
            },
          });
        }

        logger.info(`Processed killmail ${kill.killmail_id}`);
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error(
            `Error processing killmail ${kill.killmail_id}:`,
            error.message
          );
        } else {
          logger.error(
            `Unknown error processing killmail ${kill.killmail_id}:`,
            error
          );
        }
      }
    }

    logger.info("Kill relations populated");
    process.exit(0);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error("Error populating kill relations:", error.message);
    } else {
      logger.error("Unknown error populating kill relations:", error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

program.action(populateRelations);

export default program;
