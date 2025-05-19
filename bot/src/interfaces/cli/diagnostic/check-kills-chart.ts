#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";
import { RepositoryManager } from "../../../infrastructure/repositories/RepositoryManager";
import { subDays } from "date-fns";
import { CharacterRepository } from "../../../infrastructure/repositories/CharacterRepository";
import { KillsChartGenerator } from "../../../services/charts/generators/KillsChartGenerator";
import { BaseChartGenerator } from "../../../services/charts/BaseChartGenerator";

async function diagnoseKillsChart() {
  const prisma = new PrismaClient();
  const repoManager = new RepositoryManager(prisma);
  const charRepo = repoManager.getCharacterRepository();

  try {
    // Get the character group ID or name from command line arguments or use default
    const groupSlug = process.argv[2] || "shivon";
    const days = parseInt(process.argv[3] || "7"); // Default to 7 days

    logger.info(
      `Diagnosing kill chart generation for group: ${groupSlug} over the last ${days} days`
    );

    const endDate = new Date();
    const startDate = subDays(endDate, days);

    logger.info(
      `Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Find the group by slug
    const group = await prisma.characterGroup.findFirst({
      where: {
        slug: {
          equals: groupSlug,
          mode: "insensitive",
        },
      },
      include: {
        characters: true,
      },
    });

    if (!group) {
      logger.error(`Group '${groupSlug}' not found.`);
      return;
    }

    logger.info(`Found group: ${group.slug} with ID: ${group.id}`);
    logger.info(`Group has ${group.characters.length} characters`);

    // Get all character IDs in the group
    const characterIds = group.characters.map((c) => c.eveId);

    // Get main character
    const mainCharacter = group.mainCharacterId
      ? group.characters.find((c) => c.eveId === group.mainCharacterId)
      : null;

    logger.info(`Main character: ${mainCharacter?.name || "None"}`);

    // Get raw kill counts from database for comparison
    const rawDirectKills = await prisma.killFact.count({
      where: {
        character_id: {
          in: characterIds.map((id) => BigInt(id)),
        },
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    logger.info(
      `Raw database count - direct kills for group: ${rawDirectKills}`
    );

    // Count kills where any group character is in the attackers list
    const rawAttackerKills = await prisma.killFact.count({
      where: {
        attackers: {
          some: {
            character_id: {
              in: characterIds.map((id) => BigInt(id)),
            },
          },
        },
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    logger.info(
      `Raw database count - kills as attackers for group: ${rawAttackerKills}`
    );

    // Get all unique kill IDs that involve any character from the group
    const directKills = await prisma.killFact.findMany({
      where: {
        character_id: {
          in: characterIds.map((id) => BigInt(id)),
        },
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        killmail_id: true,
      },
    });

    const attackerKills = await prisma.killFact.findMany({
      where: {
        attackers: {
          some: {
            character_id: {
              in: characterIds.map((id) => BigInt(id)),
            },
          },
        },
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        killmail_id: true,
      },
    });

    const allKillIds = new Set([
      ...directKills.map((k) => k.killmail_id.toString()),
      ...attackerKills.map((k) => k.killmail_id.toString()),
    ]);

    logger.info(
      `Total unique killmail IDs involving group: ${allKillIds.size}`
    );

    // Create chart generator and run the process
    const killsChartGenerator = new KillsChartGenerator(repoManager);

    // Format characters for the chart generator
    const formattedCharacters = group.characters.map((c) => ({
      eveId: c.eveId,
      name: c.name,
    }));

    // Format group for chart generator
    const chartGroup = {
      groupId: group.id,
      name: group.slug,
      characters: formattedCharacters,
      mainCharacterId: group.mainCharacterId || undefined,
    };

    // Track original console.log to restore later
    const originalLog = console.log;

    // Override console.log to capture chart generator logging
    console.log = function (...args) {
      // Call original console.log
      originalLog.apply(console, args);

      // Log additional debug info
      if (args[0] && typeof args[0] === "string" && args[0].includes("kills")) {
        logger.info(`Chart generation log: ${args.join(" ")}`);
      }
    };

    // Generate the chart
    logger.info("Starting chart generation...");
    const chartData = await killsChartGenerator.generateChart({
      startDate,
      endDate,
      characterGroups: [chartGroup],
      displayType: "horizontalBar",
    });

    // Restore original console.log
    console.log = originalLog;

    // Log chart data
    logger.info(`Chart generation complete: ${chartData.labels.length} labels`);

    if (chartData.datasets.length > 0) {
      logger.info(
        `First dataset (${chartData.datasets[0].label}) has ${chartData.datasets[0].data.length} data points`
      );

      if (chartData.datasets[0].data.length > 0) {
        logger.info(
          `Group ${chartGroup.name} has ${chartData.datasets[0].data[0]} total kills in chart`
        );
      }
    }

    // Display summary if available
    if (chartData.summary) {
      logger.info(`Chart summary: ${chartData.summary}`);
    }

    logger.info("Diagnostic complete");
  } catch (error) {
    logger.error("Error running diagnostic:", error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseKillsChart().catch(console.error);
