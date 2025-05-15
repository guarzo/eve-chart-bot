import { BaseChartHandler } from "./BaseChartHandler";
import { CommandInteraction } from "discord.js";
import { ChartData, ChartOptions } from "../../../../types/chart";
import { ChartRenderer } from "../../../../services/ChartRenderer";
import { logger } from "../../../logger";

/**
 * Handler for the /charts heatmap command
 */
export class HeatmapHandler extends BaseChartHandler {
  private chartRenderer: ChartRenderer;

  constructor() {
    super();
    this.chartRenderer = new ChartRenderer();
  }

  /**
   * Handle the heatmap chart command
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply();

      // Get time period from command options
      const time = interaction.options.getString("time") ?? "7";
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating heatmap chart for ${time} days`);

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
      const heatmapGenerator = this.chartFactory.getGenerator("heatmap");

      // Check if view option is specified (matrix or calendar)
      const displayType = interaction.options.getString("view") ?? "matrix";

      // Generate chart data
      const chartData = await heatmapGenerator.generateChart({
        characterGroups: groups,
        startDate,
        endDate,
        displayType: displayType,
      });

      // Render chart to buffer
      logger.info(`Rendering heatmap chart with ${displayType} view`);
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary || "Activity Heatmap",
        files: [{ attachment: buffer, name: "heatmap-chart.png" }],
      });

      logger.info("Successfully sent heatmap chart");
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
      plugins: {
        title: {
          display: true,
          text: chartData.title || "Activity Heatmap",
          font: {
            size: 40,
            weight: "bold",
          },
        },
        legend: {
          display: true,
          position: "right",
        },
      },
    };

    // For heatmap/matrix view, use a nearly square format
    if (chartData.displayType === "heatmap") {
      return new ChartRenderer(2400, 2000).renderToBuffer(chartData, options);
    }

    // For calendar view, use a wider format
    return new ChartRenderer(3000, 1800).renderToBuffer(chartData, options);
  }
}
