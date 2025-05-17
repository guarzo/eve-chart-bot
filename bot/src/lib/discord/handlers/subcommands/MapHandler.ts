import { BaseChartHandler } from "./BaseChartHandler";
import { CommandInteraction } from "discord.js";
import { ChartData } from "../../../../types/chart";
import { ChartRenderer } from "../../../../services/ChartRenderer";
import { logger } from "../../../logger";
import { ChartFactory } from "../../../../services/charts";

/**
 * Handler for the /charts map command
 */
export class MapHandler extends BaseChartHandler {

  constructor() {
    super();
  }

  /**
   * Handle the map activity chart command
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply();

      // Get time period from command options
      const time = interaction.options.getString("time") ?? "7";
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating map activity chart for ${time} days`);

      // Get character groups
      const groups = await this.getCharacterGroups();

      if (groups.length === 0) {
        await interaction.editReply({
          content:
            "No character groups found. Please add characters to groups first.",
        });
        return;
      }

      // Get the chart generator from the factory
      const mapGenerator = ChartFactory.createGenerator("map");

      // Generate chart data
      const chartData = await mapGenerator.generateChart({
        characterGroups: groups,
        startDate,
        endDate,
        displayType: "horizontalBar",
      });

      // Render chart to buffer
      logger.info("Rendering map activity chart");
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary || "Map activity chart",
        files: [{ attachment: buffer, name: "map-chart.png" }],
      });

      logger.info("Successfully sent map activity chart");
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData): Promise<Buffer> {
    const options = {
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartData.title || "Map Activity by Character Group",
        },
        legend: {
          display: true,
          position: "top" as const,
        },
      },
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: "Count",
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: "Character",
          },
        },
      },
    };

    // Use a much larger canvas for better display in Discord without needing to click
    const renderer = new ChartRenderer(2200, 1400);
    return renderer.renderToBuffer(chartData, options);
  }
}
