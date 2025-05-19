#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";
import { KillRepository } from "../../../infrastructure/repositories/KillRepository";
import { RepositoryManager } from "../../../infrastructure/repositories/RepositoryManager";
import { subDays } from "date-fns";
import { CacheAdapter } from "../../../infrastructure/cache/CacheAdapter";

async function checkCharacterKills() {
  const prisma = new PrismaClient();
  const repoManager = new RepositoryManager(prisma);
  const killRepo = repoManager.getKillRepository();

  try {
    // Get the character ID from command line arguments or use default
    const characterId = process.argv[2] || "91522811"; // Shivon's ID as default
    const days = parseInt(process.argv[3] || "7"); // Default to 7 days

    logger.info(
      `Checking kill data for character ID: ${characterId} over the last ${days} days`
    );

    const endDate = new Date();
    const startDate = subDays(endDate, days);

    logger.info(
      `Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Check direct database query for raw kill count
    const directKillCount = await prisma.killFact.count({
      where: {
        character_id: BigInt(characterId),
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    logger.info(
      `Direct database query - character as main killer: ${directKillCount} kills`
    );

    // Count kills where character is in the attackers list
    const attackerKillCount = await prisma.killFact.count({
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

    logger.info(
      `Direct database query - character as attacker: ${attackerKillCount} kills`
    );

    // Check using repository method for direct kills
    const repoDirectKills = await killRepo.getKillsForCharacter(
      characterId,
      startDate,
      endDate
    );

    logger.info(
      `Repository method - getKillsForCharacter: ${repoDirectKills.length} kills`
    );

    // Check using repository method for all kills (including as attacker)
    const repoAllKills = await killRepo.getAllKillsForCharacters(
      [characterId],
      startDate,
      endDate
    );

    logger.info(
      `Repository method - getAllKillsForCharacters: ${repoAllKills.length} kills`
    );

    // Get the character and group info
    const character = await prisma.character.findUnique({
      where: { eveId: characterId },
      include: {
        characterGroup: true,
      },
    });

    if (character && character.characterGroup) {
      logger.info(
        `Character ${character.name} belongs to group: ${character.characterGroup.slug}`
      );

      // Get all characters in the same group
      const groupCharacters = await prisma.character.findMany({
        where: {
          characterGroupId: character.characterGroupId,
        },
      });

      const groupCharacterIds = groupCharacters.map((c) => c.eveId);
      logger.info(`Group has ${groupCharacterIds.length} characters`);

      // Get kills for the whole group
      const groupKills = await killRepo.getKillsForCharacters(
        groupCharacterIds,
        startDate,
        endDate
      );

      logger.info(
        `Group method - getKillsForCharacters: ${groupKills.length} kills for group`
      );

      // Get all kills where any character in the group participated
      const allGroupKills = await killRepo.getAllKillsForCharacters(
        groupCharacterIds,
        startDate,
        endDate
      );

      logger.info(
        `Group method - getAllKillsForCharacters: ${allGroupKills.length} kills for group`
      );

      // Extra: Show per-character breakdown within the group
      for (const groupChar of groupCharacters) {
        const charKills = await prisma.killFact.count({
          where: {
            character_id: BigInt(groupChar.eveId),
            kill_time: {
              gte: startDate,
              lte: endDate,
            },
          },
        });

        if (charKills > 0) {
          logger.info(
            `Character ${groupChar.name} (${groupChar.eveId}): ${charKills} direct kills`
          );
        }
      }
    }

    logger.info("Diagnostic check complete");
  } catch (error) {
    logger.error("Error running diagnostic check:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCharacterKills().catch(console.error);
