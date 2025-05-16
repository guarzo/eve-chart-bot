import { BaseChartHandler } from "./BaseChartHandler";
import { CommandInteraction } from "discord.js";
import { ChartData } from "../../../../types/chart";
import { ChartRenderer } from "../../../../services/ChartRenderer";
import { logger } from "../../../logger";
import { ChartFactory } from "../../../../services/charts";

/**
 * Handler for the /charts loss command
 */
export class LossHandler extends BaseChartHandler {
  private chartRenderer: ChartRenderer;

  constructor() {
    super();
    this.chartRenderer = new ChartRenderer();
  }

  /**
   * Handle the ship loss chart command
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply();

      // Get time period from command options
      const time = interaction.options.getString("time") ?? "7";
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating loss chart for ${time} days`);

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
      const lossGenerator = ChartFactory.createGenerator("loss");

      // Generate chart data
      const chartData = await lossGenerator.generateChart({
        characterGroups: groups,
        startDate,
        endDate,
        displayType: "horizontalBar",
      });

      // Render chart to buffer
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary || "Loss chart",
        files: [{ attachment: buffer, name: "loss-chart.png" }],
      });

      logger.info("Successfully sent loss chart");
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
          text: chartData.title || "Losses by Character Group",
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
            text: "ISK Lost",
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
