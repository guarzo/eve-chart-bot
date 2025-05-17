import { CommandInteraction } from "discord.js";
import { logger } from "../logger";
import { ChartService } from "../../services/ChartService";
import { ChartRenderer } from "../../services/ChartRenderer";
import { ChartsCommandHandler } from "./handlers/ChartsCommandHandler";

const chartService = new ChartService();
const chartRenderer = new ChartRenderer();
const chartsCommandHandler = new ChartsCommandHandler();

/**
 * Main handler for the /charts command and its subcommands
 * Delegates to the new handler system
 */
export async function handleChartsCommand(interaction: CommandInteraction) {
  // Use the new command handler
  await chartsCommandHandler.handle(interaction);
}

// Legacy handlers kept for backward compatibility
export async function handleKillsCommand(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) return;

  try {
    logger.info(
      "Legacy /kills command used - consider using /charts kills instead"
    );

    // Get the display type from options
    const displayType = interaction.options.getString("type") ?? "line";

    await handleLegacyKillCommand(interaction, displayType);
  } catch (error) {
    logger.error("Error handling legacy kill command:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (interaction.replied) {
      await interaction.followUp({
        content: `Error generating kill chart: ${errorMessage}`,
        ephemeral: true,
      });
    } else if (interaction.deferred) {
      await interaction.editReply({
        content: `Error generating kill chart: ${errorMessage}`,
      });
    } else {
      await interaction.reply({
        content: `Error generating kill chart: ${errorMessage}`,
        ephemeral: true,
      });
    }
  }
}

export async function handleMapCommand(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) return;

  try {
    logger.info(
      "Legacy /map command used - consider using /charts map instead"
    );

    // Get the display type from options
    const displayType = interaction.options.getString("type") ?? "line";

    await handleLegacyMapCommand(interaction, displayType);
  } catch (error) {
    logger.error("Error handling legacy map command:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (interaction.replied) {
      await interaction.followUp({
        content: `Error generating map chart: ${errorMessage}`,
        ephemeral: true,
      });
    } else if (interaction.deferred) {
      await interaction.editReply({
        content: `Error generating map chart: ${errorMessage}`,
      });
    } else {
      await interaction.reply({
        content: `Error generating map chart: ${errorMessage}`,
        ephemeral: true,
      });
    }
  }
}

// Helper function for legacy kill command
async function handleLegacyKillCommand(
  interaction: CommandInteraction,
  displayType: string
) {
  await interaction.deferReply();

  // Get tracked characters
  const characterIds = await getTrackedCharacters();

  if (characterIds.length === 0) {
    await interaction.editReply({
      content:
        "No characters are currently being tracked. Please add characters first.",
    });
    return;
  }

  // Generate time range (default to 7 days for legacy commands)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);

  // Generate chart using legacy chart service
  const chartData = await chartService.generateChart({
    type: "kills",
    characterIds,
    period: "7d",
    displayType: displayType as any,
  });

  // Render chart
  const buffer = await chartRenderer.renderToBuffer(chartData, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `Kills - Last 7 days`,
      },
      legend: {
        display: true,
        position: "top",
      },
    },
  });

  // Send chart
  await interaction.editReply({
    content:
      "Here is your kill chart (consider using /charts kills for enhanced charts):",
    files: [{ attachment: buffer, name: "kill-chart.png" }],
  });
}

// Helper function for legacy map command
async function handleLegacyMapCommand(
  interaction: CommandInteraction,
  displayType: string
) {
  await interaction.deferReply();

  // Get tracked characters
  const characterIds = await getTrackedCharacters();

  if (characterIds.length === 0) {
    await interaction.editReply({
      content:
        "No characters are currently being tracked. Please add characters first.",
    });
    return;
  }

  // Generate time range (default to 7 days for legacy commands)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);

  // Generate chart using legacy chart service
  const chartData = await chartService.generateChart({
    type: "map_activity",
    characterIds,
    period: "7d",
    displayType: displayType as any,
  });

  // Render chart
  const buffer = await chartRenderer.renderToBuffer(chartData, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `Map Activity - Last 7 days`,
      },
      legend: {
        display: true,
        position: "top",
      },
    },
  });

  // Send chart
  await interaction.editReply({
    content:
      "Here is your map activity chart (consider using /charts map for enhanced charts):",
    files: [{ attachment: buffer, name: "map-chart.png" }],
  });
}

// Helper function for getting character data
async function getTrackedCharacters(): Promise<bigint[]> {
  const characters = await chartService.getTrackedCharacters();
  return characters.map((c) => BigInt(c.eveId));
}
