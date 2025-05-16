import { BaseChartGenerator } from "../BaseChartGenerator";
import {
  ChartData,
  ComplexDataPoint,
  ChartDisplayType,
} from "../../../types/chart";
import { DistributionChartConfig } from "../config";
import { KillRepository } from "../../../data/repositories/KillRepository";
import { format } from "date-fns";
import { logger } from "../../../lib/logger";

interface DistributionData {
  killmailId: string;
  attackerCount: number;
}

/**
 * Generator for distribution charts
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
      mainCharacterId?: string;
    }>;
    displayType: string;
  }): Promise<ChartData> {
    const { startDate, endDate, characterGroups, displayType } = options;

    // Get all character IDs from all groups
    const characterIds = characterGroups.flatMap((group) =>
      group.characters.map((c) => BigInt(c.eveId))
    );

    // Get distribution data for all characters
    const distributionData = await this.killRepository.getDistributionData(
      characterIds.map((id) => id.toString()),
      startDate,
      endDate
    );

    // Group data by character group
    const groupData = characterGroups.map((group) => {
      const groupCharacterIds = group.characters.map((c) => BigInt(c.eveId));
      const groupData = distributionData.filter((data: DistributionData) =>
        groupCharacterIds.includes(BigInt(data.killmailId))
      );

      // Calculate solo and group kills
      const soloKills = groupData.filter(
        (data: DistributionData) => data.attackerCount === 1
      ).length;
      const groupKills = groupData.filter(
        (data: DistributionData) => data.attackerCount > 1
      ).length;

      return {
        group,
        data: groupData,
        soloKills,
        groupKills,
      };
    });

    // Sort groups by total kills
    groupData.sort(
      (a, b) => b.soloKills + b.groupKills - (a.soloKills + a.groupKills)
    );

    // Create chart data
    return {
      labels: groupData.map((data) => this.getGroupDisplayName(data.group)),
      datasets: [
        {
          label: "Solo Kills",
          data: groupData.map((data) => data.soloKills),
          backgroundColor: this.getDatasetColors("distribution").primary,
        },
        {
          label: "Group Kills",
          data: groupData.map((data) => data.groupKills),
          backgroundColor: this.getDatasetColors("distribution").secondary,
        },
      ],
      displayType: "horizontalBar" as ChartDisplayType,
    };
  }

  /**
   * Generate a box plot showing distribution of attacker counts
   */
  private async generateBoxPlot(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Get all kills with attacker counts
    const kills = await this.getAllKillAttackerCounts(
      characterGroups,
      startDate,
      endDate
    );

    // Group kills by attacker count
    const groupedKills: Record<number, number[]> = {};
    for (const kill of kills) {
      if (!groupedKills[kill.attackerCount]) {
        groupedKills[kill.attackerCount] = [];
      }
      groupedKills[kill.attackerCount].push(kill.attackerCount);
    }

    // Calculate box plot statistics for each group
    const boxPlotData = Object.entries(groupedKills).map(([count, values]) => {
      const sorted = values.sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const median = sorted[Math.floor(sorted.length * 0.5)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const min = sorted[0];
      const max = sorted[sorted.length - 1];

      return {
        x: parseInt(count),
        y: median,
        v: q3 - q1, // Interquartile range
        min,
        q1,
        median,
        q3,
        max,
        outliers: values.filter((v) => v < min || v > max),
      } as ComplexDataPoint;
    });

    return {
      labels: Object.keys(groupedKills),
      datasets: [
        {
          label: "Group Size Distribution",
          data: boxPlotData,
          backgroundColor: this.colors[0],
          borderColor: this.colors[0],
          borderWidth: 1,
        },
      ],
      displayType: "boxplot" as ChartDisplayType,
      title: `Kill Group Size Distribution (Box Plot) - ${format(
        startDate,
        "MMM d"
      )} to ${format(endDate, "MMM d, yyyy")}`,
      summary: `Box plot showing the distribution of attacker counts per kill. Each box shows the median, quartiles, and range of group sizes.`,
    };
  }

  /**
   * Generate a violin plot showing density of attacker counts
   */
  private async generateViolinPlot(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Get all kills with attacker counts
    const kills = await this.getAllKillAttackerCounts(
      characterGroups,
      startDate,
      endDate
    );

    // Group kills by attacker count
    const groupedKills: Record<number, number[]> = {};
    for (const kill of kills) {
      if (!groupedKills[kill.attackerCount]) {
        groupedKills[kill.attackerCount] = [];
      }
      groupedKills[kill.attackerCount].push(kill.attackerCount);
    }

    // Calculate density for each group
    const violinData = Object.entries(groupedKills).map(([count, values]) => {
      // Simple density estimation using histogram
      const min = Math.min(...values);
      const max = Math.max(...values);
      const bins = 20;
      const binSize = (max - min) / bins;
      const histogram = new Array(bins).fill(0);

      for (const value of values) {
        const binIndex = Math.min(
          Math.floor((value - min) / binSize),
          bins - 1
        );
        histogram[binIndex]++;
      }

      // Normalize to get density
      const maxCount = Math.max(...histogram);
      const density = histogram.map((count) => count / maxCount);

      return {
        x: parseInt(count),
        y: density.reduce((a, b) => a + b, 0) / density.length, // Average density
        v: Math.max(...density), // Peak density
      } as ComplexDataPoint;
    });

    return {
      labels: Object.keys(groupedKills),
      datasets: [
        {
          label: "Group Size Density",
          data: violinData,
          backgroundColor: this.colors[1],
          borderColor: this.colors[1],
          borderWidth: 1,
        },
      ],
      displayType: "violin" as ChartDisplayType,
      title: `Kill Group Size Distribution (Violin Plot) - ${format(
        startDate,
        "MMM d"
      )} to ${format(endDate, "MMM d, yyyy")}`,
      summary: `Violin plot showing the density distribution of attacker counts per kill. The width of each violin represents the frequency of group sizes.`,
    };
  }

  /**
   * Generate a pie chart showing distribution of kills by group size category
   */
  private async generatePieChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Get all character IDs from the groups
    const characterIds = characterGroups.flatMap((group) =>
      group.characters.map((char) => char.eveId)
    );

    // Get kill data grouped by attacker count
    const killData = await this.killRepository.getKillsWithAttackerCount(
      characterIds,
      startDate,
      endDate
    );

    // Group kills by attacker count category
    const categories = new Map<string, number>();
    for (const kill of killData) {
      const category = this.getAttackerCountCategory(kill.attackerCount);
      categories.set(category, (categories.get(category) || 0) + 1);
    }

    // Convert to array and sort by count
    const sortedCategories = Array.from(categories.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    // Create chart data
    const chartData = {
      labels: sortedCategories.map(([label]) => label),
      datasets: [
        {
          label: "Kills by Group Size",
          data: sortedCategories.map(([_, count]) => count),
          backgroundColor: this.colors.slice(0, sortedCategories.length),
          borderColor: this.colors
            .slice(0, sortedCategories.length)
            .map((color) => this.adjustColorBrightness(color, -20)),
        },
      ],
      displayType: "pie" as ChartDisplayType,
      title: `Kill Distribution by Group Size - ${format(
        startDate,
        "MMM d"
      )} to ${format(endDate, "MMM d, yyyy")}`,
      summary: `Distribution of kills by group size category for the selected period.`,
    };

    return chartData;
  }

  /**
   * Generate a bar chart showing distribution of attacker counts per kill
   */
  private async generateBarChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Get all kills with attacker counts
    const kills = await this.getAllKillAttackerCounts(
      characterGroups,
      startDate,
      endDate
    );

    // Build histogram: attackerCount -> number of kills
    const histogram: Record<number, number> = {};
    for (const kill of kills) {
      if (!histogram[kill.attackerCount]) {
        histogram[kill.attackerCount] = 0;
      }
      histogram[kill.attackerCount]++;
    }

    // Prepare sorted data for chart
    const sortedCounts = Object.keys(histogram)
      .map((k) => parseInt(k, 10))
      .sort((a, b) => a - b);
    const labels = sortedCounts.map((count) => count.toString());
    const data = sortedCounts.map((count) => histogram[count]);

    return {
      labels,
      datasets: [
        {
          label: "Kills",
          data,
          backgroundColor: "#FF7043",
          borderColor: "#FF7043",
        },
      ],
      displayType: "bar" as ChartDisplayType,
      title: `Kill Group Size Distribution - ${format(
        startDate,
        "MMM d"
      )} to ${format(endDate, "MMM d, yyyy")}`,
      summary: `Distribution of kills by number of attackers (group size) for the selected period.`,
    };
  }

  /**
   * Helper to get all kills with attacker counts for the given groups
   */
  private async getAllKillAttackerCounts(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ killmailId: string; attackerCount: number }>> {
    const characterIds = characterGroups
      .flatMap((group) => group.characters)
      .map((character) => character.eveId);
    if (characterIds.length === 0) return [];
    return this.killRepository.getKillsWithAttackerCount(
      characterIds,
      startDate,
      endDate
    );
  }

  /**
   * Categorize kills based on attacker count
   */
  private getAttackerCountCategory(
    count: number
  ): "solo" | "small" | "medium" | "large" {
    if (count === 1) return "solo";
    if (count <= 5) return "small";
    if (count <= 10) return "medium";
    return "large";
  }
}
