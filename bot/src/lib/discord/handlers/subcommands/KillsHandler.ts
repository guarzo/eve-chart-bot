import { BaseChartHandler } from "./BaseChartHandler";
import { CommandInteraction } from "discord.js";
import { ChartData, ChartOptions } from "../../../../types/chart";
import { ChartRenderer } from "../../../../services/ChartRenderer";
import { logger } from "../../../logger";

/**
 * Handler for the /charts kills command
 */
export class KillsHandler extends BaseChartHandler {
  private chartRenderer: ChartRenderer;

  constructor() {
    super();
    this.chartRenderer = new ChartRenderer();
  }

  /**
   * Handle the kills chart command
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply();

      // Get time period from command options
      const time = interaction.options.getString("time") ?? "7";
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating kills chart for ${time} days`);

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
      const killsGenerator = this.chartFactory.getGenerator("kills");

      // Generate chart data
      const chartData = await killsGenerator.generateChart({
        characterGroups: groups,
        startDate,
        endDate,
        displayType: "horizontalBar",
      });

      // Render chart to buffer
      logger.info("Rendering kills chart");
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary - make sure not to return this value
      await interaction.editReply({
        content: chartData.summary || "Kills chart",
        files: [{ attachment: buffer, name: "kills-chart.png" }],
      });

      logger.info("Successfully sent kills chart");
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData): Promise<Buffer> {
    // Create a simpler options object that conforms to the ChartOptions interface
    const options: ChartOptions = {
      indexAxis: "y", // Horizontal bar chart
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 2.5, // Wider aspect ratio for better horizontal display
      plugins: {
        title: {
          display: true,
          text: chartData.title || "Kills by Character Group",
          font: {
            size: 40, // Extra large title
            weight: "bold",
          },
        },
        legend: {
          display: true,
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: (context: any): string => {
              const label = context.dataset.label || "";
              const value = context.parsed.x;
              return `${label}: ${value.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: false, // Not stacked so solo kills can be seen
          ticks: {
            callback: (value: any): string => {
              // Format numbers with K/M/B suffixes
              if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
              if (value >= 1000) return (value / 1000).toFixed(1) + "K";
              return value.toString();
            },
          },
          title: {
            display: true,
            text: "Count",
          },
        },
        y: {
          stacked: false, // Not stacked so solo kills can be seen
          beginAtZero: true,
          title: {
            display: true,
            text: "Character",
          },
        },
      },
    };

    // Use a very wide canvas for horizontal bar chart display in Discord
    const renderer = new ChartRenderer(3200, 1280);

    // Set the data point styling
    if (chartData.datasets.length >= 2) {
      // Set distinct colors for total kills vs solo kills
      // Use solid colors for better visibility in Discord
      if (chartData.datasets[0].label === "Total Kills") {
        chartData.datasets[0].backgroundColor = "#3366CC"; // Blue for total kills
      }

      if (chartData.datasets[1].label === "Solo Kills") {
        chartData.datasets[1].backgroundColor = "#DC3912"; // Red for solo kills
      }

      // Add borders for better definition
      chartData.datasets[0].borderColor = "#1A478F"; // Darker blue border
      chartData.datasets[1].borderColor = "#8F1A1A"; // Darker red border

      // Log the solo kill values
      console.log(
        "Solo kills dataset:",
        JSON.stringify(chartData.datasets[1].data)
      );
    }

    // Pass additional styling options to the renderer
    return renderer.renderToBuffer(chartData, options);
  }
}
