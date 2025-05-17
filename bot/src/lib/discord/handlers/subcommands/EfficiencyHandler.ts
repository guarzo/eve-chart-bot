import { BaseChartHandler } from "./BaseChartHandler";
import { CommandInteraction } from "discord.js";
import { ChartData, ChartOptions } from "../../../../types/chart";
import { ChartRenderer } from "../../../../services/ChartRenderer";
import { logger } from "../../../logger";
import { ChartFactory } from "../../../../services/charts";

/**
 * Handler for the /charts efficiency command
 * Shows efficiency metrics with gauge charts
 */
export class EfficiencyHandler extends BaseChartHandler {

  constructor() {
    super();
  }

  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply();

      // Get time period from command options
      const time = interaction.options.getString("time") ?? "7";
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating efficiency chart for ${time} days`);

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
      const efficiencyGenerator = ChartFactory.createGenerator("efficiency");

      // Generate chart data
      const chartData = await efficiencyGenerator.generateChart({
        characterGroups: groups,
        startDate,
        endDate,
        displayType: "gauge",
      });

      // Render chart to buffer
      logger.info("Rendering efficiency chart");
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary || "Efficiency Chart",
        files: [{ attachment: buffer, name: "efficiency-chart.png" }],
      });

      logger.info("Successfully sent efficiency chart");
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData): Promise<Buffer> {
    let options: ChartOptions;

    if (chartData.displayType === "gauge") {
      // Options for a gauge/doughnut chart
      options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: chartData.title || "Efficiency by Character Group",
            font: {
              size: 40,
              weight: "bold",
            },
          },
          legend: {
            display: false, // Hide legend for gauge
            position: "top" as const,
          },
        },
        rotation: -Math.PI,
        circumference: Math.PI,
        cutout: "70%",
      } as any; // Chart.js options for doughnut
    } else {
      // Bar chart options (existing)
      options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: chartData.title || "Efficiency by Character Group",
            font: {
              size: 40,
              weight: "bold",
            },
          },
          legend: {
            display: true,
            position: "top" as const,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            suggestedMax: 100,
            title: {
              display: true,
              text: "Efficiency (%)",
            },
          },
          y: {
            title: {
              display: true,
              text: "Character Group",
            },
          },
        },
      };
    }

    // Use a wide canvas for better display
    const renderer = new ChartRenderer(3000, 1600);
    return renderer.renderToBuffer(chartData, options);
  }
}
