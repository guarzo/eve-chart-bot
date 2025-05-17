import { BaseChartHandler } from "./BaseChartHandler";
import { CommandInteraction } from "discord.js";
import { ChartData, ChartOptions } from "../../../../types/chart";
import { ChartRenderer } from "../../../../services/ChartRenderer";
import { logger } from "../../../logger";
import { ChartFactory } from "../../../../services/charts";

/**
 * Handler for the /charts trend command
 */
export class TrendHandler extends BaseChartHandler {
  constructor() {
    super();
  }

  /**
   * Handle the trend chart command
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply();

      // Get time period from command options
      const time = interaction.options.getString("time") ?? "7";
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating trend chart for ${time} days`);

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
      const trendGenerator = ChartFactory.createGenerator("trend");

      // Check if view option is specified (line, area, or dual)
      const displayType = interaction.options.getString("view") ?? "line";

      // Generate chart data
      const chartData = await trendGenerator.generateChart({
        characterGroups: groups,
        startDate,
        endDate,
        displayType: displayType,
      });

      // Render chart to buffer
      logger.info(`Rendering trend chart with ${displayType} view`);
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary || "Trend Chart",
        files: [{ attachment: buffer, name: "trend-chart.png" }],
      });

      logger.info("Successfully sent trend chart");
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData): Promise<Buffer> {
    // Create options object based on chartData.options or use defaults
    const options: ChartOptions =
      chartData.options ||
      ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: chartData.title || "Kill Activity Over Time",
            font: {
              size: 40,
              weight: "bold",
            },
          },
          legend: {
            display: true,
            position: "top",
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Kill Count",
            },
          },
          x: {
            type: "time",
            time: {
              unit: "day",
              displayFormats: {
                hour: "MMM d, HH:mm",
                day: "MMM d",
                week: "MMM d, yyyy",
                month: "MMM yyyy",
              },
            },
            title: {
              display: true,
              text: "Date",
            },
          },
        },
      } as ChartOptions); // Cast to ChartOptions to ensure type compatibility

    // For dual-axis charts, use wide format
    if (
      chartData.options &&
      chartData.options.scales &&
      chartData.options.scales.y2
    ) {
      return new ChartRenderer(3200, 1600).renderToBuffer(chartData, options);
    }

    // For area charts, use slightly taller format
    if (chartData.datasets.some((d) => d.fill === true)) {
      return new ChartRenderer(3000, 1800).renderToBuffer(chartData, options);
    }

    // Default format for line charts
    return new ChartRenderer(3000, 1500).renderToBuffer(chartData, options);
  }
}
