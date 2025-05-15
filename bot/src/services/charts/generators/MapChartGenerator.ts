import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData } from "../../../types/chart";
import { logger } from "../../../lib/logger";
import { MapChartConfig } from "../config";
import { MapActivityRepository } from "../../../data/repositories/MapActivityRepository";
import { format } from "date-fns";

/**
 * Generator for map activity charts
 */
export class MapChartGenerator extends BaseChartGenerator {
  private mapActivityRepository: MapActivityRepository;

  constructor() {
    super();
    this.mapActivityRepository = new MapActivityRepository();
  }

  /**
   * Generate a map activity chart based on the provided options
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
      `Generating map activity chart from ${startDate.toISOString()} to ${endDate.toISOString()}`
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
      logger.error("Error generating map activity chart:", error);
      throw error;
    }
  }

  /**
   * Generate a horizontal bar chart showing map activity by character group
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
    const systemsData: number[] = [];
    const signaturesData: number[] = [];
    let totalSystems = 0;
    let totalSignatures = 0;

    // Get map activity stats for each group
    for (const group of characterGroups) {
      const stats = await this.mapActivityRepository.getGroupActivityStats(
        group.groupId,
        startDate,
        endDate
      );

      // Skip empty groups
      if (stats.totalSystems === 0 && stats.totalSignatures === 0) {
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
      systemsData.push(stats.totalSystems);
      signaturesData.push(stats.totalSignatures);

      totalSystems += stats.totalSystems;
      totalSignatures += stats.totalSignatures;
    }

    // If no data was found, add a placeholder
    if (labels.length === 0) {
      logger.info(
        "No map activity data found, adding placeholder data for display"
      );
      labels.push("No Activity");
      systemsData.push(0);
      signaturesData.push(0);
    }

    // Create a summary message
    const summary = `Map Activity: ${totalSystems} systems visited, ${totalSignatures} signatures scanned in the last ${this.getDaysBetween(
      startDate,
      endDate
    )} days`;

    // Return the chart data
    return {
      labels,
      datasets: [
        {
          label: "Systems Visited",
          data: systemsData,
          backgroundColor: this.getDatasetColors("map").primary,
        },
        {
          label: "Signatures Scanned",
          data: signaturesData,
          backgroundColor: this.getDatasetColors("map").secondary,
        },
      ],
      title: `Map Activity by Character Group (${this.formatDateRange(
        startDate,
        endDate
      )})`,
      summary,
      displayType: "horizontalBar",
    };
  }

  /**
   * Generate a vertical bar chart showing map activity by character group
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
   * Generate a timeline chart showing map activity over time
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
    let totalSystems = 0;
    let totalSignatures = 0;

    // Process each group
    for (let i = 0; i < characterGroups.length; i++) {
      const group = characterGroups[i];

      // Get all character IDs for this group
      const characterIds = group.characters.map((char) => char.eveId);

      if (characterIds.length === 0) {
        continue;
      }

      // Get map activity data grouped by time
      const activityData =
        await this.mapActivityRepository.getActivityGroupedByTime(
          characterIds,
          startDate,
          endDate,
          groupBy
        );

      // Skip if no data
      if (activityData.length === 0) {
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
      const systemData: number[] = [];
      const signatureData: number[] = [];
      const timePoints: string[] = [];

      for (const point of activityData) {
        const formattedTime = format(
          point.timestamp,
          this.getDateFormat(groupBy)
        );
        timePoints.push(formattedTime);
        timeLabels.add(formattedTime);

        systemData.push(point.systems);
        signatureData.push(point.signatures);

        totalSystems += point.systems;
        totalSignatures += point.signatures;
      }

      // Add datasets for this group
      datasets.push({
        label: `${displayName} - Systems`,
        data: systemData,
        backgroundColor: this.getColorForIndex(i * 2),
        borderColor: this.getColorForIndex(i * 2),
        fill: false,
      });

      datasets.push({
        label: `${displayName} - Signatures`,
        data: signatureData,
        backgroundColor: this.getColorForIndex(i * 2 + 1),
        borderColor: this.getColorForIndex(i * 2 + 1),
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
      title: `Map Activity Over Time - ${format(
        startDate,
        "MMM dd"
      )} to ${format(endDate, "MMM dd")}`,
      displayType: "line",
      summary: MapChartConfig.getDefaultSummary(totalSystems, totalSignatures),
    };

    return chartData;
  }

  /**
   * Get number of days between two dates
   */
  private getDaysBetween(startDate: Date, endDate: Date): number {
    const millisPerDay = 24 * 60 * 60 * 1000;
    return Math.round((endDate.getTime() - startDate.getTime()) / millisPerDay);
  }

  /**
   * Format date range as a string
   */
  private formatDateRange(startDate: Date, endDate: Date): string {
    return `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
  }
}
