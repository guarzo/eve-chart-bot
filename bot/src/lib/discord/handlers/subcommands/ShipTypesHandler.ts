import { BaseChartHandler } from "./BaseChartHandler";
import { CommandInteraction } from "discord.js";
import { ChartData, ChartOptions } from "../../../../types/chart";
import { ChartRenderer } from "../../../../services/ChartRenderer";
import { logger } from "../../../logger";
import { ChartFactory } from "../../../../services/charts";

/**
 * Handler for the /charts shiptypes command
 */
export class ShipTypesHandler extends BaseChartHandler {
  constructor() {
    super();
  }

  /**
   * Handle the ship types chart command
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply();

      // Get time period from command options
      const time = interaction.options.getString("time") ?? "7";
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating ship types chart for ${time} days`);

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
      const shipTypesGenerator = ChartFactory.createGenerator("shiptypes");

      // Generate chart data
      const chartData = await shipTypesGenerator.generateChart({
        characterGroups: groups,
        startDate,
        endDate,
        displayType: "horizontalBar", // horizontal bar is the default for ship types
      });

      // Render chart to buffer
      logger.info("Rendering ship types chart");
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary || "Ship Types Chart",
        files: [{ attachment: buffer, name: "shiptypes-chart.png" }],
      });

      logger.info("Successfully sent ship types chart");
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
      indexAxis: "y", // Horizontal bar chart by default
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartData.title || "Ship Types Destroyed",
          font: {
            size: 40, // Extra large title
            weight: "bold",
          },
        },
        legend: {
          display: false, // Don't need legend for single dataset
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: (context: any): string => {
              const label = context.dataset.label || "";
              const value = context.parsed.x;
              return `${label}: ${value.toLocaleString()} ships`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Count",
          },
          ticks: {
            callback: (value: any): string => {
              // Format numbers with K/M/B suffixes
              if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
              if (value >= 1000) return (value / 1000).toFixed(1) + "K";
              return value.toString();
            },
          },
        },
        y: {
          title: {
            display: true,
            text: "Ship Type",
          },
        },
      },
    };

    // Use a wide canvas for horizontal bar chart display in Discord
    const renderer = new ChartRenderer(3200, 1280);

    // For line charts/timelines, use a different renderer size
    if (chartData.displayType === "line") {
      return new ChartRenderer(2800, 1400).renderToBuffer(chartData, options);
    }

    return renderer.renderToBuffer(chartData, options);
  }
}
