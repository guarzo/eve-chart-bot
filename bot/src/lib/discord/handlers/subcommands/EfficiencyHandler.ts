import { BaseChartHandler } from "./BaseChartHandler";
import { CommandInteraction } from "discord.js";
import { ChartData, ChartOptions } from "../../../../types/chart";
import { ChartRenderer } from "../../../../services/ChartRenderer";
import { logger } from "../../../logger";
import { EfficiencyBulletConfig } from "../../../../services/charts/config/EfficiencyBulletConfig";

/**
 * Handler for the /charts efficiency command
 * Shows efficiency metrics with bullet charts
 */
export class EfficiencyHandler extends BaseChartHandler {
  private chartRenderer: ChartRenderer;

  constructor() {
    super();
    this.chartRenderer = new ChartRenderer();
  }

  async handle(interaction: CommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();

      const timePeriod = interaction.options.getString("time") || "7";
      const { startDate, endDate } = this.getTimeRange(timePeriod);

      // Get character groups
      const groups = await this.characterRepository.getCharacterGroups();

      // Get efficiency data for each group
      const efficiencyData = await Promise.all(
        groups.map(async (group) => {
          const kills = await this.characterRepository.getKillsByTimeRange(
            startDate,
            endDate,
            group.id
          );
          const losses = await this.characterRepository.getLossesByTimeRange(
            startDate,
            endDate,
            group.id
          );

          // Calculate efficiency metrics
          const totalKills = kills.length;
          const totalLosses = losses.length;
          const efficiency = (totalKills / (totalKills + totalLosses)) * 100;

          return {
            group: group.name,
            efficiency: Math.min(100, Math.max(0, efficiency)), // Clamp between 0-100
            target: 75, // Target efficiency percentage
          };
        })
      );

      // Sort by efficiency
      efficiencyData.sort((a, b) => b.efficiency - a.efficiency);

      // Create chart data
      const chartData: ChartData = {
        type: "bar",
        data: {
          labels: efficiencyData.map((d) => d.group),
          datasets: [
            {
              ...EfficiencyBulletConfig.data.datasets[0],
              data: efficiencyData.map((d) => d.efficiency),
            },
            {
              ...EfficiencyBulletConfig.data.datasets[1],
              data: efficiencyData.map((d) => d.target),
            },
          ],
        },
        options: EfficiencyBulletConfig.options,
      };

      // Generate and send chart
      const chartBuffer = await this.chartRenderer.renderChart(chartData);
      await interaction.editReply({
        files: [
          {
            attachment: chartBuffer,
            name: "efficiency.png",
          },
        ],
      });

      logger.info("Successfully generated efficiency chart");
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }
}
