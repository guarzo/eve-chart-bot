#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";
import { subDays } from "date-fns";

async function checkKills() {
  const prisma = new PrismaClient();

  try {
    // Get the character ID from command line
    const characterId = process.argv[2];
    const days = parseInt(process.argv[3] || "7");

    if (!characterId) {
      logger.error(
        "Character ID is required. Usage: npm run check-kills <characterId> [days]"
      );
      return;
    }

    const endDate = new Date();
    const startDate = subDays(endDate, days);

    // Get character info
    const character = await prisma.character.findUnique({
      where: { eveId: characterId },
      include: { characterGroup: true },
    });

    if (!character) {
      logger.error(`Character with ID ${characterId} not found in database`);
      return;
    }

    logger.info(`Character: ${character.name} (${characterId})`);
    logger.info(`Group: ${character.characterGroup?.slug || "None"}`);
    logger.info(
      `Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Direct kills
    const directKills = await prisma.killFact.count({
      where: {
        character_id: BigInt(characterId),
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Attacker kills
    const attackerKills = await prisma.killFact.count({
      where: {
        attackers: {
          some: {
            character_id: BigInt(characterId),
          },
        },
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Unique kills
    const uniqueKills = await prisma.killFact.findMany({
      where: {
        OR: [
          { character_id: BigInt(characterId) },
          {
            attackers: {
              some: {
                character_id: BigInt(characterId),
              },
            },
          },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { killmail_id: true },
    });

    const uniqueCount = new Set(
      uniqueKills.map((k) => k.killmail_id.toString())
    ).size;

    logger.info(`Direct kills (as main killer): ${directKills}`);
    logger.info(`Kills as attacker: ${attackerKills}`);
    logger.info(`Total unique kills: ${uniqueCount}`);

    // Check if character is in a group
    if (character.characterGroup) {
      // Get all characters in the group
      const groupMembers = await prisma.character.findMany({
        where: { characterGroupId: character.characterGroupId },
      });

      const groupIds = groupMembers.map((c) => c.eveId);
      logger.info(
        `Group has ${groupMembers.length} characters: ${groupIds.join(", ")}`
      );

      // Get group kills in chart
      if (groupMembers.length > 0) {
        const allGroupKills = await prisma.killFact.findMany({
          where: {
            OR: [
              {
                character_id: {
                  in: groupMembers.map((c) => BigInt(c.eveId)),
                },
              },
              {
                attackers: {
                  some: {
                    character_id: {
                      in: groupMembers.map((c) => BigInt(c.eveId)),
                    },
                  },
                },
              },
            ],
            kill_time: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: { killmail_id: true },
        });

        const uniqueGroupKills = new Set(
          allGroupKills.map((k) => k.killmail_id.toString())
        ).size;
        logger.info(`Group unique kills: ${uniqueGroupKills}`);
      }
    }
  } catch (error) {
    logger.error("Error checking kills:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkKills().catch((error) => {
  logger.error("Unhandled exception:", error);
  process.exit(1);
});
