import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData } from "../../../types/chart";
import { logger } from "../../../lib/logger";
import { KillsChartConfig } from "../config";
import { KillRepository } from "../../../data/repositories/KillRepository";
import { format } from "date-fns";

/**
 * Generator for kill-related charts
 */
export class KillsChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;

  constructor() {
    super();
    this.killRepository = new KillRepository();
  }

  /**
   * Generate a kills chart based on the provided options
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
    const { startDate, endDate, characterGroups, displayType } = options;

    logger.info(
      `Generating kills chart from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );
    logger.info(
      `Chart type: ${displayType}, Groups: ${characterGroups.length}`
    );

    try {
      if (displayType === "horizontalBar") {
        return this.generateHorizontalBarChart(
          characterGroups,
          startDate,
          endDate
        );
      } else if (displayType === "bar") {
        return this.generateVerticalBarChart(
          characterGroups,
          startDate,
          endDate
        );
      } else {
        // Default to line chart (timeline)
        return this.generateTimelineChart(characterGroups, startDate, endDate);
      }
    } catch (error) {
      logger.error("Error generating kills chart:", error);
      throw error;
    }
  }

  /**
   * Generate a horizontal bar chart showing kills by character group
   */
  private async generateHorizontalBarChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Prepare data arrays
    const labels: string[] = [];
    const totalKillsData: number[] = [];
    const soloKillsData: number[] = [];
    let overallTotalKills = 0;
    let overallSoloKills = 0;

    // Get kill stats for each group
    for (const group of characterGroups) {
      // Use the enhanced stats method to get both solo and group solo kills
      const stats = await this.killRepository.getGroupKillStatsEnhanced(
        group.groupId,
        startDate,
        endDate
      );

      // Skip empty groups
      if (stats.totalKills === 0) {
        continue;
      }

      // Determine proper display name for the group
      let displayName = group.name;

      // Try to find the main character or use the first character
      if (group.characters.length > 0) {
        const mainCharacter = group.characters.find((char) =>
          group.characters.some(
            (c) =>
              c.eveId !== char.eveId && c.name.includes(char.name.split(" ")[0])
          )
        );

        if (mainCharacter) {
          displayName = mainCharacter.name;
        } else {
          displayName = group.characters[0].name;
        }
      }

      labels.push(displayName);
      totalKillsData.push(stats.totalKills);

      // Count either true solo kills or group solo kills (whichever is higher)
      const effectiveSoloKills = Math.max(
        stats.soloKills,
        stats.groupSoloKills
      );

      // Ensure solo kills are visible - add a minimum value if there are any
      if (effectiveSoloKills > 0) {
        // Make sure solo kills are at least 10% of total kills for visibility,
        // with a minimum of the actual solo kills count
        soloKillsData.push(
          Math.max(effectiveSoloKills, Math.ceil(stats.totalKills * 0.2))
        );
        console.log(
          `Enhanced visibility for ${displayName}: True solo kills: ${
            stats.soloKills
          }, Group solo kills: ${stats.groupSoloKills}, Displayed as: ${
            soloKillsData[soloKillsData.length - 1]
          }`
        );
      } else {
        soloKillsData.push(0);
      }

      overallTotalKills += stats.totalKills;
      overallSoloKills += effectiveSoloKills;

      // Log for debugging
      console.log(
        `Character: ${displayName}, Total Kills: ${
          stats.totalKills
        }, True Solo Kills: ${stats.soloKills}, Group Solo Kills: ${
          stats.groupSoloKills
        }, Display Solo: ${soloKillsData[soloKillsData.length - 1]}`
      );
    }

    // Log the complete arrays
    console.log("Total Kills Data:", totalKillsData);
    console.log("Solo Kills Data:", soloKillsData);
    console.log(
      "Overall Stats - Total Kills:",
      overallTotalKills,
      "Solo Kills:",
      overallSoloKills
    );

    // Replace color definitions with
    const primaryColor = this.getDatasetColors("kills").primary;
    const secondaryColor = this.getDatasetColors("kills").secondary;

    // Make the colors more consistent by using our utility function
    const totalColors = this.getVisibleColors(
      totalKillsData,
      Array(totalKillsData.length).fill(primaryColor)
    );
    const soloColors = this.getVisibleColors(
      soloKillsData,
      Array(soloKillsData.length).fill(secondaryColor)
    );

    // Create chart data
    const chartData: ChartData = {
      labels,
      datasets: [
        {
          label: KillsChartConfig.metrics[0].name,
          data: totalKillsData,
          backgroundColor: totalColors,
          borderColor: KillsChartConfig.metrics[0].color,
        },
        {
          label: KillsChartConfig.metrics[1].name,
          data: soloKillsData,
          backgroundColor: soloColors,
          borderColor: KillsChartConfig.metrics[1].color,
        },
      ],
      title: `${KillsChartConfig.title} - ${format(
        startDate,
        "MMM dd"
      )} to ${format(endDate, "MMM dd")}`,
      displayType: "horizontalBar",
      summary: KillsChartConfig.getDefaultSummary(
        overallTotalKills,
        overallSoloKills
      ),
    };

    return chartData;
  }

  /**
   * Generate a vertical bar chart showing kills by character group
   */
  private async generateVerticalBarChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // This is similar to horizontal bar chart but with a different orientation
    const chartData = await this.generateHorizontalBarChart(
      characterGroups,
      startDate,
      endDate
    );
    chartData.displayType = "bar";
    return chartData;
  }

  /**
   * Generate a timeline chart showing kills over time
   */
  private async generateTimelineChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // First, determine the appropriate time grouping based on date range
    const dateRange = endDate.getTime() - startDate.getTime();
    const days = dateRange / (1000 * 60 * 60 * 24);

    let groupBy: "hour" | "day" | "week" = "day";
    if (days <= 2) {
      groupBy = "hour";
    } else if (days > 30) {
      groupBy = "week";
    }

    // Create a dataset for each character group
    const datasets = [];
    const timeLabels = new Set<string>();
    let overallTotalKills = 0;
    let overallSoloKills = 0;

    // Process each group
    for (let i = 0; i < characterGroups.length; i++) {
      const group = characterGroups[i];

      // Get all character IDs for this group
      const characterIds = group.characters.map((char) => char.eveId);

      if (characterIds.length === 0) {
        continue;
      }

      // Get kill data grouped by time
      const killData = await this.killRepository.getKillsGroupedByTime(
        characterIds,
        startDate,
        endDate,
        groupBy
      );

      // Skip if no data
      if (killData.length === 0) {
        continue;
      }

      // Determine proper display name for the group
      let displayName = group.name;

      // Try to find the main character or use the first character
      if (group.characters.length > 0) {
        const mainCharacter = group.characters.find((char) =>
          group.characters.some(
            (c) =>
              c.eveId !== char.eveId && c.name.includes(char.name.split(" ")[0])
          )
        );

        if (mainCharacter) {
          displayName = mainCharacter.name;
        } else {
          displayName = group.characters[0].name;
        }
      }

      // Extract the data points and collect labels
      const dataPoints: number[] = [];
      const timePoints: string[] = [];

      let groupTotalKills = 0;
      let groupSoloKills = 0;

      for (const point of killData) {
        const formattedTime = format(
          point.timestamp,
          this.getDateFormat(groupBy)
        );
        timePoints.push(formattedTime);
        timeLabels.add(formattedTime);

        dataPoints.push(point.kills);
        groupTotalKills += point.kills;

        // Calculate solo kills (this is an approximation and may need refinement)
        const soloKills = killData
          .filter((k) => k.timestamp.getTime() === point.timestamp.getTime())
          .reduce((solo, k) => solo + (k.kills === 1 ? 1 : 0), 0);
        groupSoloKills += soloKills;
      }

      // Update overall statistics
      overallTotalKills += groupTotalKills;
      overallSoloKills += groupSoloKills;

      // Add dataset for this group
      datasets.push({
        label: displayName,
        data: dataPoints,
        backgroundColor: this.getColorForIndex(i),
        borderColor: this.getColorForIndex(i),
        fill: false,
      });
    }

    // Sort the time labels chronologically
    const sortedLabels = Array.from(timeLabels).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });

    // Create chart data
    const chartData: ChartData = {
      labels: sortedLabels,
      datasets,
      title: `Kill Activity Over Time - ${format(
        startDate,
        "MMM dd"
      )} to ${format(endDate, "MMM dd")}`,
      displayType: "line",
      summary: KillsChartConfig.getDefaultSummary(
        overallTotalKills,
        overallSoloKills
      ),
    };

    return chartData;
  }
}
