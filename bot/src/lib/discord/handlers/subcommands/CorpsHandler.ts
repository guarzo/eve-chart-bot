import { BaseChartHandler } from "./BaseChartHandler";
import { CommandInteraction } from "discord.js";
import { ChartData, ChartOptions } from "../../../../types/chart";
import { ChartRenderer } from "../../../../services/ChartRenderer";
import { logger } from "../../../logger";
import { ChartFactory } from "../../../../services/charts";

/**
 * Handler for the /charts corps command
 */
export class CorpsHandler extends BaseChartHandler {

  constructor() {
    super();
  }

  /**
   * Handle the corps chart command
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply();

      // Get time period from command options
      const time = interaction.options.getString("time") ?? "7";
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating enemy corporations chart for ${time} days`);

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
      const corpsGenerator = ChartFactory.createGenerator("corps");

      // Check if view option is specified (horizontalBar, verticalBar, or pie)
      const displayType =
        interaction.options.getString("view") ?? "horizontalBar";

      // Generate chart data
      const chartData = await corpsGenerator.generateChart({
        characterGroups: groups,
        startDate,
        endDate,
        displayType: displayType,
      });

      // Render chart to buffer
      logger.info(
        `Rendering enemy corporations chart with ${displayType} view`
      );
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary || "Enemy Corporations Chart",
        files: [{ attachment: buffer, name: "corps-chart.png" }],
      });

      logger.info("Successfully sent enemy corporations chart");
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData): Promise<Buffer> {
    // Create options object based on chartData.options or use defaults
    const options: ChartOptions = chartData.options || {
      responsive: true,
      maintainAspectRatio: false,
    };

    // Use different canvas sizes based on chart type
    if (chartData.displayType === "pie") {
      return new ChartRenderer(2400, 2400).renderToBuffer(chartData, options);
    } else if (chartData.displayType === "bar") {
      // Vertical bar chart
      return new ChartRenderer(3000, 1800).renderToBuffer(chartData, options);
    } else {
      // Horizontal bar chart (default)
      return new ChartRenderer(3200, 1600).renderToBuffer(chartData, options);
    }
  }
}
