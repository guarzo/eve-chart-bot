import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData } from "../../../types/chart";
import { TrendChartConfig } from "../config";
import { KillRepository } from "../../../data/repositories";
import { format } from "date-fns";
import { logger } from "../../../lib/logger";

/**
 * Generator for trend charts showing kills over time
 */
export class TrendChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;

  constructor() {
    super();
    this.killRepository = new KillRepository();
  }

  /**
   * Generate a trend chart based on the provided options
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
        `Generating trend chart from ${startDate.toISOString()} to ${endDate.toISOString()}`
      );
      logger.debug(
        `Chart type: ${displayType}, Groups: ${characterGroups.length}`
      );

      // Select chart generation function based on display type
      if (displayType === "area") {
        return this.generateAreaChart(characterGroups, startDate, endDate);
      } else if (displayType === "dual") {
        return this.generateDualAxisChart(characterGroups, startDate, endDate);
      } else {
        // Default to line chart (timeline)
        return this.generateTimelineChart(characterGroups, startDate, endDate);
      }
    } catch (error) {
      logger.error("Error generating trend chart:", error);
      throw error;
    }
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
    let allDataPoints: number[] = []; // Used for trend calculation

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

      for (const point of killData) {
        const formattedTime = format(
          point.timestamp,
          this.getDateFormat(groupBy)
        );
        timePoints.push(formattedTime);
        timeLabels.add(formattedTime);

        dataPoints.push(point.kills);
        groupTotalKills += point.kills;
        allDataPoints.push(point.kills); // For trend calculation
      }

      // Update overall statistics
      overallTotalKills += groupTotalKills;

      // Add dataset for this group
      datasets.push({
        label: displayName,
        data: dataPoints,
        backgroundColor:
          TrendChartConfig.colors[i % TrendChartConfig.colors.length],
        borderColor:
          TrendChartConfig.colors[i % TrendChartConfig.colors.length],
        fill: false,
      });
    }

    // Sort the time labels chronologically
    const sortedLabels = Array.from(timeLabels).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });

    // Calculate average kills per day
    const dayCount = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const averageKillsPerDay = overallTotalKills / dayCount;

    // Calculate the trend (increasing, stable, or decreasing)
    const trend = this.calculateTrend(allDataPoints);

    // Create chart data
    const chartData: ChartData = {
      labels: sortedLabels,
      datasets,
      displayType: "line",
      title: `${TrendChartConfig.title} - ${format(
        startDate,
        "MMM d"
      )} to ${format(endDate, "MMM d, yyyy")}`,
      options: TrendChartConfig.timelineOptions,
      summary: TrendChartConfig.getDefaultSummary(
        overallTotalKills,
        averageKillsPerDay,
        trend
      ),
    };

    return chartData;
  }

  /**
   * Generate an area chart showing cumulative kills over time
   */
  private async generateAreaChart(
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
    let allDataPoints: number[] = []; // Used for trend calculation

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

      // Extract the data points and collect labels (cumulative sum)
      const dataPoints: number[] = [];
      const timePoints: string[] = [];

      let cumulativeKills = 0;
      let groupTotalKills = 0;

      for (const point of killData) {
        const formattedTime = format(
          point.timestamp,
          this.getDateFormat(groupBy)
        );
        timePoints.push(formattedTime);
        timeLabels.add(formattedTime);

        cumulativeKills += point.kills;
        dataPoints.push(cumulativeKills);
        groupTotalKills += point.kills;
        allDataPoints.push(point.kills); // For trend calculation
      }

      // Update overall statistics
      overallTotalKills += groupTotalKills;

      // Add dataset for this group with area filling
      datasets.push({
        label: displayName,
        data: dataPoints,
        backgroundColor: this.adjustColorTransparency(
          TrendChartConfig.colors[i % TrendChartConfig.colors.length],
          0.6
        ),
        borderColor:
          TrendChartConfig.colors[i % TrendChartConfig.colors.length],
        fill: true,
      });
    }

    // Sort the time labels chronologically
    const sortedLabels = Array.from(timeLabels).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });

    // Calculate average kills per day
    const dayCount = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const averageKillsPerDay = overallTotalKills / dayCount;

    // Calculate the trend (increasing, stable, or decreasing)
    const trend = this.calculateTrend(allDataPoints);

    // Create chart data
    const chartData: ChartData = {
      labels: sortedLabels,
      datasets,
      displayType: "line", // Still use line type but with fill
      title: `Cumulative ${TrendChartConfig.title} - ${format(
        startDate,
        "MMM d"
      )} to ${format(endDate, "MMM d, yyyy")}`,
      options: TrendChartConfig.areaOptions,
      summary: TrendChartConfig.getDefaultSummary(
        overallTotalKills,
        averageKillsPerDay,
        trend
      ),
    };

    return chartData;
  }

  /**
   * Generate a dual-axis chart showing kills and value over time
   */
  private async generateDualAxisChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Combine all groups for a total view
    const allCharacterIds: string[] = [];

    // Extract all character IDs from all groups
    for (const group of characterGroups) {
      allCharacterIds.push(...group.characters.map((char) => char.eveId));
    }

    if (allCharacterIds.length === 0) {
      throw new Error("No characters found in the provided groups");
    }

    // Determine appropriate time grouping
    const dateRange = endDate.getTime() - startDate.getTime();
    const days = dateRange / (1000 * 60 * 60 * 24);

    let groupBy: "hour" | "day" | "week" = "day";
    if (days <= 2) {
      groupBy = "hour";
    } else if (days > 30) {
      groupBy = "week";
    }

    // Get kill data grouped by time
    const killData = await this.killRepository.getKillsGroupedByTime(
      allCharacterIds,
      startDate,
      endDate,
      groupBy
    );

    if (killData.length === 0) {
      throw new Error("No kill data found for the specified time period");
    }

    // Prepare data for the dual-axis chart
    const killsData: number[] = [];
    const valueData: number[] = []; // Convert bigint to number for charting
    const timeLabels: string[] = [];

    let totalKills = 0;
    let allKillsData: number[] = []; // For trend calculation

    // Process the kill data
    for (const point of killData) {
      const formattedTime = format(
        point.timestamp,
        this.getDateFormat(groupBy)
      );
      timeLabels.push(formattedTime);

      killsData.push(point.kills);
      allKillsData.push(point.kills);
      totalKills += point.kills;

      // Convert bigint to number, handling potential overflow
      const valueInISK =
        Number(point.value) > Number.MAX_SAFE_INTEGER
          ? Number.MAX_SAFE_INTEGER
          : Number(point.value);
      valueData.push(valueInISK);
    }

    // Create datasets for kills (line) and values (bar)
    const datasets = [
      {
        label: "Kills",
        data: killsData,
        backgroundColor: this.adjustColorTransparency("#3366CC", 0.7),
        borderColor: "#3366CC",
        fill: false,
        type: "line" as "line",
        yAxisID: "y",
      },
      {
        label: "Total Value (ISK)",
        data: valueData,
        backgroundColor: this.adjustColorTransparency("#DC3912", 0.7),
        borderColor: "#DC3912",
        fill: false,
        type: "bar" as "bar",
        yAxisID: "y1",
      },
    ];

    // Calculate average kills per day
    const dayCount = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const averageKillsPerDay = totalKills / dayCount;

    // Calculate the trend (increasing, stable, or decreasing)
    const trend = this.calculateTrend(allKillsData);

    // Create chart data
    const chartData: ChartData = {
      labels: timeLabels,
      datasets,
      displayType: "line", // Use line type for dual-axis chart
      title: `Kills vs. Value Over Time - ${format(
        startDate,
        "MMM d"
      )} to ${format(endDate, "MMM d, yyyy")}`,
      options: TrendChartConfig.dualAxisOptions,
      summary:
        TrendChartConfig.getDefaultSummary(
          totalKills,
          averageKillsPerDay,
          trend
        ) + " with value metrics",
    };

    return chartData;
  }

  /**
   * Calculate trend direction from a series of data points
   */
  private calculateTrend(
    dataPoints: number[]
  ): "increasing" | "stable" | "decreasing" {
    if (dataPoints.length < 3) {
      return "stable"; // Not enough data to determine trend
    }

    // Simple linear regression to determine trend
    const n = dataPoints.length;
    const xValues = Array.from({ length: n }, (_, i) => i);

    // Calculate means
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = dataPoints.reduce((sum, y) => sum + y, 0) / n;

    // Calculate slope
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (dataPoints[i] - yMean);
      denominator += Math.pow(xValues[i] - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;

    // Determine trend direction
    if (slope > 0.05) {
      return "increasing";
    } else if (slope < -0.05) {
      return "decreasing";
    } else {
      return "stable";
    }
  }

  /**
   * Get a date format string based on the grouping level
   */
  protected getDateFormat(groupBy: "hour" | "day" | "week"): string {
    switch (groupBy) {
      case "hour":
        return "MMM d, HH:mm";
      case "day":
        return "MMM d";
      case "week":
        return "'Week' W, MMM yyyy";
      default:
        return "MMM d";
    }
  }

  /**
   * Adjust color transparency (for area charts)
   */
  private adjustColorTransparency(color: string, alpha: number): string {
    if (color.startsWith("#")) {
      // Convert hex to rgb
      const r = parseInt(color.substring(1, 3), 16);
      const g = parseInt(color.substring(3, 5), 16);
      const b = parseInt(color.substring(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } else if (color.startsWith("rgb(")) {
      // Convert rgb to rgba
      return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
    } else if (color.startsWith("rgba(")) {
      // Replace existing alpha
      return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
    }
    return color;
  }
}
