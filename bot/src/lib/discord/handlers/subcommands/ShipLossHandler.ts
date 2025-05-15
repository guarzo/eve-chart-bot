import { BaseChartHandler } from "./BaseChartHandler";
import { ShipLossChartGenerator } from "../../../../services/charts/generators/ShipLossChartGenerator";
import { CommandInteraction } from "discord.js";
import { logger } from "../../../../lib/logger";
import { ChartRenderer } from "../../../../services/ChartRenderer";
import { ChartData } from "../../../../types/chart";
import { Character } from "@prisma/client";

export class ShipLossHandler extends BaseChartHandler {
  private chartGenerator: ShipLossChartGenerator;
  private chartRenderer: ChartRenderer;

  constructor() {
    super();
    this.chartGenerator = new ShipLossChartGenerator();
    this.chartRenderer = new ChartRenderer();
  }

  async handle(interaction: CommandInteraction): Promise<void> {
    try {
      // Get time range from interaction options
      const timePeriod =
        (interaction.options.get("time")?.value as string) || "7";
      const { startDate, endDate } = this.getTimeRange(timePeriod);

      // Get character groups from interaction
      const groupId = interaction.options.get("group")?.value as string;
      if (!groupId) {
        await interaction.reply({
          content: "Please specify a character group.",
          ephemeral: true,
        });
        return;
      }

      // Get group details
      const groups = await this.characterRepository.getCharacterGroups();
      const group = groups.find((g) => g.groupId === groupId);
      if (!group) {
        await interaction.reply({
          content: "Character group not found.",
          ephemeral: true,
        });
        return;
      }

      // Generate chart data
      const chartData = await this.chartGenerator.generateChart({
        startDate,
        endDate,
        characterGroups: [
          {
            groupId: group.groupId,
            name: group.name,
            characters: group.characters.map((c) => ({
              eveId: c.eveId,
              name: c.name,
            })),
          },
        ],
        displayType: "horizontalBar",
      });

      // Render and send the chart
      const buffer = await this.renderChart(chartData);
      await interaction.reply({
        files: [
          {
            attachment: buffer,
            name: "ship-losses.png",
          },
        ],
      });
    } catch (error) {
      logger.error("Error generating ship loss chart:", error);
      await this.handleError(interaction, error);
    }
  }

  private async renderChart(chartData: ChartData): Promise<Buffer> {
    const options = {
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartData.title || "Ships Lost by Type",
        },
        legend: {
          display: true,
          position: "top" as const,
        },
      },
      scales: {
        x: {
          stacked: false,
          title: {
            display: true,
            text: "Count",
          },
        },
        y: {
          stacked: false,
          beginAtZero: true,
          title: {
            display: true,
            text: "Ship Type",
          },
        },
      },
    };

    return this.chartRenderer.renderToBuffer(chartData, options);
  }
}
