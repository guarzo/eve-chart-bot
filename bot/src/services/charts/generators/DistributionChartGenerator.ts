import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData } from "../../../types/chart";
import { DistributionChartConfig } from "../config";
import { KillRepository } from "../../../data/repositories";
import { format } from "date-fns";
import { logger } from "../../../lib/logger";

/**
 * Generator for kill distribution charts
 */
export class DistributionChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;

  constructor() {
    super();
    this.killRepository = new KillRepository();
  }

  /**
   * Generate a kill distribution chart based on the provided options
   */
  async generateChart(options: {
    startDate: Date;
    endDate: Date;
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>;
    displayType: string;
  }): Promise<ChartData> {
    try {
      const { startDate, endDate, characterGroups, displayType } = options;
      logger.info(
        `Generating kill distribution chart from ${startDate.toISOString()} to ${endDate.toISOString()}`
      );
      logger.debug(
        `Chart type: ${displayType}, Groups: ${characterGroups.length}`
      );

      // Select chart generation function based on display type
      if (displayType === "bar") {
        return this.generateBarChart(characterGroups, startDate, endDate);
      } else if (displayType === "doughnut") {
        return this.generateDoughnutChart(characterGroups, startDate, endDate);
      } else {
        // Default to pie chart
        return this.generatePieChart(characterGroups, startDate, endDate);
      }
    } catch (error) {
      logger.error("Error generating distribution chart:", error);
      throw error;
    }
  }

  /**
   * Generate a pie chart showing distribution of solo vs. group kills
   */
  private async generatePieChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Get distribution data
    const distributionData = await this.getKillDistributionData(
      characterGroups,
      startDate,
      endDate
    );

    // Only include non-zero categories for cleaner visualization
    const filteredLabels: string[] = [];
    const filteredData: number[] = [];
    const filteredColors: string[] = [];

    Object.entries(distributionData.counts).forEach(([key, value]) => {
      if (value > 0) {
        filteredLabels.push(
          DistributionChartConfig.groupLabels[
            key as keyof typeof DistributionChartConfig.groupLabels
          ]
        );
        filteredData.push(value);
        filteredColors.push(
          DistributionChartConfig.groupColors[
            key as keyof typeof DistributionChartConfig.groupColors
          ]
        );
      }
    });

    // Create chart data
    const chartData: ChartData = {
      labels: filteredLabels,
      datasets: [
        {
          label: "Kills",
          data: filteredData,
          backgroundColor: filteredColors,
          borderColor: filteredColors.map((color) =>
            this.adjustColorBrightness(color, -20)
          ),
        },
      ],
      displayType: "pie",
      title: `${DistributionChartConfig.title} - ${format(
        startDate,
        "MMM d"
      )} to ${format(endDate, "MMM d, yyyy")}`,
      options: DistributionChartConfig.pieOptions,
      summary: DistributionChartConfig.getDefaultSummary(
        distributionData.totalKills,
        distributionData.counts.solo,
        distributionData.counts.smallGroup,
        distributionData.counts.mediumGroup,
        distributionData.counts.largeGroup,
        distributionData.counts.blob
      ),
    };

    return chartData;
  }

  /**
   * Generate a doughnut chart showing distribution of solo vs. group kills
   */
  private async generateDoughnutChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Use the same data preparation as pie chart
    const chartData = await this.generatePieChart(
      characterGroups,
      startDate,
      endDate
    );

    // Override to doughnut type and options
    chartData.displayType = "doughnut";
    chartData.options = DistributionChartConfig.doughnutOptions;

    return chartData;
  }

  /**
   * Generate a bar chart showing distribution of solo vs. group kills
   */
  private async generateBarChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Get distribution data
    const distributionData = await this.getKillDistributionData(
      characterGroups,
      startDate,
      endDate
    );

    // Only include non-zero categories for cleaner visualization
    const filteredLabels: string[] = [];
    const filteredData: number[] = [];
    const filteredColors: string[] = [];

    // Use the same order as defined in config
    const groupOrder = [
      "solo",
      "smallGroup",
      "mediumGroup",
      "largeGroup",
      "blob",
    ];

    groupOrder.forEach((key) => {
      const value =
        distributionData.counts[key as keyof typeof distributionData.counts];
      if (value > 0) {
        filteredLabels.push(
          DistributionChartConfig.groupLabels[
            key as keyof typeof DistributionChartConfig.groupLabels
          ]
        );
        filteredData.push(value);
        filteredColors.push(
          DistributionChartConfig.groupColors[
            key as keyof typeof DistributionChartConfig.groupColors
          ]
        );
      }
    });

    // Create chart data
    const chartData: ChartData = {
      labels: filteredLabels,
      datasets: [
        {
          label: "Kills",
          data: filteredData,
          backgroundColor: filteredColors,
          borderColor: filteredColors.map((color) =>
            this.adjustColorBrightness(color, -20)
          ),
        },
      ],
      displayType: "bar",
      title: `${DistributionChartConfig.title} - ${format(
        startDate,
        "MMM d"
      )} to ${format(endDate, "MMM d, yyyy")}`,
      options: DistributionChartConfig.barOptions,
      summary: DistributionChartConfig.getDefaultSummary(
        distributionData.totalKills,
        distributionData.counts.solo,
        distributionData.counts.smallGroup,
        distributionData.counts.mediumGroup,
        distributionData.counts.largeGroup,
        distributionData.counts.blob
      ),
    };

    return chartData;
  }

  /**
   * Get kill distribution data by group size categories
   */
  private async getKillDistributionData(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalKills: number;
    counts: {
      solo: number;
      smallGroup: number;
      mediumGroup: number;
      largeGroup: number;
      blob: number;
    };
  }> {
    // Extract all character IDs from the groups
    const characterIds = characterGroups
      .flatMap((group) => group.characters)
      .map((character) => character.eveId);

    if (characterIds.length === 0) {
      throw new Error("No characters found in the provided groups");
    }

    // Get all kills with attacker counts
    const kills = await this.killRepository.getKillsWithAttackerCount(
      characterIds,
      startDate,
      endDate
    );

    if (kills.length === 0) {
      throw new Error("No kill data found for the specified time period");
    }

    // Initialize counts
    const counts = {
      solo: 0,
      smallGroup: 0,
      mediumGroup: 0,
      largeGroup: 0,
      blob: 0,
    };

    // Categorize kills by attacker count
    kills.forEach((kill) => {
      const attackerCount = kill.attackerCount;

      if (attackerCount <= DistributionChartConfig.groupSizes.solo) {
        counts.solo++;
      } else if (
        attackerCount <= DistributionChartConfig.groupSizes.smallGroup
      ) {
        counts.smallGroup++;
      } else if (
        attackerCount <= DistributionChartConfig.groupSizes.mediumGroup
      ) {
        counts.mediumGroup++;
      } else if (
        attackerCount <= DistributionChartConfig.groupSizes.largeGroup
      ) {
        counts.largeGroup++;
      } else {
        counts.blob++;
      }
    });

    return {
      totalKills: kills.length,
      counts,
    };
  }
}
