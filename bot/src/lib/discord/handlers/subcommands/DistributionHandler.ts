import { BaseChartHandler } from "./BaseChartHandler";
import { CommandInteraction } from "discord.js";
import { ChartOptions } from "../../../../types/chart";
import { ChartRenderer } from "../../../../services/ChartRenderer";
import { logger } from "../../../logger";
import { ChartFactory } from "../../../../services/charts";

/**
 * Handler for the /charts distribution command
 */
export class DistributionHandler extends BaseChartHandler {
  private chartRenderer: ChartRenderer;

  constructor() {
    super();
    this.chartRenderer = new ChartRenderer();
  }

  /**
   * Handle a distribution chart command
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply();

      // Extract options from the command
      const time = interaction.options.getString("time") ?? "7";
      const displayOption = interaction.options.getString("display") ?? "pie";

      // Get the time range
      const { startDate, endDate } = this.getTimeRange(time);

      // Get all character groups
      const characterGroups =
        await this.characterRepository.getCharacterGroups();

      if (characterGroups.length === 0) {
        await interaction.editReply(
          "No character groups found. Please add characters first."
        );
        return;
      }

      // Get the chart generator
      const generator = ChartFactory.createGenerator("distribution");

      // Generate the chart data
      const chartData = await generator.generateChart({
        startDate,
        endDate,
        characterGroups,
        displayType: displayOption,
      });

      // Render the chart
      const buffer = await this.chartRenderer.renderToBuffer(
        chartData,
        chartData.options as ChartOptions
      );

      // Send the chart image
      await interaction.editReply({
        content: chartData.summary,
        files: [{ attachment: buffer, name: "distribution-chart.png" }],
      });
    } catch (error: any) {
      logger.error("Error handling distribution chart command:", error);
      await interaction.editReply(`Error generating chart: ${error.message}`);
    }
  }
}
