import { CommandInteraction } from "discord.js";
import { PrismaClient } from "@prisma/client";
import { logger } from "../logger";
import { ChartService } from "../../services/ChartService";
import { ChartRenderer } from "../../services/ChartRenderer";
import { ChartOptions } from "../../types/chart";

const prisma = new PrismaClient();
const chartService = new ChartService();
const chartRenderer = new ChartRenderer();

export async function handleKillsCommand(interaction: CommandInteraction) {
  try {
    logger.info("Handling kills command with default values");

    // Get chart type option if provided
    const chartType =
      (interaction.options.get("type")?.value as string) || "line";
    logger.info(`Using chart type: ${chartType}`);

    // Defer reply since chart generation might take a while
    logger.info("Deferring kill command reply");
    await interaction.deferReply();
    logger.info("Successfully deferred reply");

    // Get all tracked characters
    logger.info("Fetching all tracked characters");
    const characters = await prisma.character.findMany({
      where: {
        isMain: true,
      },
    });
    logger.info("Found tracked characters:", {
      characterCount: characters.length,
      characters: characters.map((c) => ({ id: c.eveId, name: c.name })),
    });

    if (characters.length === 0) {
      await interaction.editReply({
        content:
          "No characters found to generate chart for. Please add some characters first.",
      });
      return;
    }

    // Calculate time range (default to 7 days)
    const now = new Date();
    const startTime = new Date(now);
    startTime.setDate(now.getDate() - 7);

    logger.info("Calculated time range:", {
      startTime,
      endTime: now,
    });

    // Generate chart data
    const chartData = await chartService.generateChart({
      type: "kills",
      characterIds: characters.map((c) => BigInt(c.eveId)),
      period: "7d",
      groupBy: "day",
      displayType: chartType as "line" | "bar",
    });

    // Create chart options
    const options: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartData.title || "Kills - Last 7 Days",
        },
        legend: {
          display: true,
          position: "top" as const,
        },
      },
    };

    // Render chart to buffer
    const buffer = await chartRenderer.renderToBuffer(chartData, options);

    // Send the chart
    await interaction.editReply({
      files: [
        {
          attachment: buffer,
          name: "kills-chart.png",
        },
      ],
    });
    logger.info("Successfully sent kill chart");
  } catch (error) {
    logger.error("Error handling kills command:", {
      error:
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
              stack: error.stack,
            }
          : error,
      interaction: {
        id: interaction.id,
        commandName: interaction.commandName,
        user: interaction.user.tag,
      },
    });
    // Don't throw the error, handle it gracefully
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "An error occurred while processing your command.",
        ephemeral: true,
      });
    } else {
      await interaction.editReply({
        content: "An error occurred while processing your command.",
      });
    }
  }
}

export async function handleMapCommand(interaction: CommandInteraction) {
  try {
    logger.info("Handling map command with default values");

    // Get chart type option if provided
    const chartType =
      (interaction.options.get("type")?.value as string) || "line";
    logger.info(`Using chart type: ${chartType}`);

    // Defer reply since chart generation might take a while
    logger.info("Deferring map command reply");
    await interaction.deferReply();
    logger.info("Successfully deferred reply");

    // Get all tracked characters
    logger.info("Fetching all tracked characters");
    const characters = await prisma.character.findMany({
      where: {
        isMain: true,
      },
    });
    logger.info("Found tracked characters:", {
      characterCount: characters.length,
      characters: characters.map((c) => ({ id: c.eveId, name: c.name })),
    });

    if (characters.length === 0) {
      await interaction.editReply({
        content:
          "No characters found to generate chart for. Please add some characters first.",
      });
      return;
    }

    // Calculate time range (default to 24 hours)
    const now = new Date();
    const startTime = new Date(now);
    startTime.setHours(now.getHours() - 24);

    logger.info("Calculated time range:", {
      startTime,
      endTime: now,
    });

    // Generate chart data
    const chartData = await chartService.generateChart({
      type: "map_activity",
      characterIds: characters.map((c) => BigInt(c.eveId)),
      period: "24h",
      groupBy: "hour",
      displayType: chartType as "line" | "bar",
    });

    // Create chart options
    const options: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartData.title || "Map Activity - Last 24 Hours",
        },
        legend: {
          display: true,
          position: "top" as const,
        },
      },
    };

    // Render chart to buffer
    const buffer = await chartRenderer.renderToBuffer(chartData, options);

    // Send the chart
    await interaction.editReply({
      files: [
        {
          attachment: buffer,
          name: "map-activity-chart.png",
        },
      ],
    });
    logger.info("Successfully sent map activity chart");
  } catch (error) {
    logger.error("Error handling map command:", {
      error:
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
              stack: error.stack,
            }
          : error,
      interaction: {
        id: interaction.id,
        commandName: interaction.commandName,
        user: interaction.user.tag,
      },
    });
    // Don't throw the error, handle it gracefully
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "An error occurred while processing your command.",
        ephemeral: true,
      });
    } else {
      await interaction.editReply({
        content: "An error occurred while processing your command.",
      });
    }
  }
}
