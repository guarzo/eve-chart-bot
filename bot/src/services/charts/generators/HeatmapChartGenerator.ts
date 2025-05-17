import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData } from "../../../types/chart";
import { HeatmapChartConfig } from "../config";
import { KillRepository } from "../../../infrastructure/repositories/KillRepository";
import { format } from "date-fns";
import { logger } from "../../../lib/logger";
import { RepositoryManager } from "../../../infrastructure/repositories/RepositoryManager";

/**
 * Generator for heatmap charts showing activity by time of day
 */
export class HeatmapChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;

  /**
   * Create a new heatmap chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    this.killRepository = this.repoManager.getKillRepository();
  }

  /**
   * Generate a heatmap chart based on the provided options
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
        `Generating heatmap chart from ${startDate.toISOString()} to ${endDate.toISOString()}`
      );
      logger.debug(
        `Chart type: ${displayType}, Groups: ${characterGroups.length}`
      );

      // Select chart generation function based on display type
      if (displayType === "calendar") {
        return this.generateCalendarHeatmap(
          characterGroups,
          startDate,
          endDate
        );
      } else {
        // Default to basic heatmap
        return this.generateBasicHeatmap(characterGroups, startDate, endDate);
      }
    } catch (error) {
      logger.error("Error generating heatmap chart:", error);
      throw error;
    }
  }

  /**
   * Generate a basic heatmap showing activity by hour and day of week
   */
  private async generateBasicHeatmap(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Combine all character IDs from all groups
    const allCharacterIds: string[] = [];
    for (const group of characterGroups) {
      allCharacterIds.push(...group.characters.map((c) => c.eveId));
    }

    if (allCharacterIds.length === 0) {
      throw new Error("No characters found in the provided groups");
    }

    // Get activity data grouped by hour and day of week
    const activityData = await this.killRepository.getKillActivityByTimeOfDay(
      allCharacterIds,
      startDate,
      endDate
    );

    if (activityData.length === 0) {
      throw new Error("No activity data found for the specified time period");
    }

    // Calculate total kills and find the peak activity
    let totalKills = 0;
    let peakKills = 0;
    let peakDay = 0;
    let peakHour = 0;

    for (const data of activityData) {
      totalKills += data.kills;
      if (data.kills > peakKills) {
        peakKills = data.kills;
        peakDay = data.dayOfWeek;
        peakHour = data.hourOfDay;
      }
    }

    // Create a 2D matrix for the heatmap: rows = hours, columns = days
    const matrix: number[][] = [];
    for (let hour = 0; hour < 24; hour++) {
      const row: number[] = [];
      for (let day = 0; day < 7; day++) {
        const activity = activityData.find(
          (d) => d.hourOfDay === hour && d.dayOfWeek === day
        );
        row.push(activity ? activity.kills : 0);
      }
      matrix.push(row);
    }

    // Only include hours with activity
    const filteredMatrix: number[][] = [];
    const filteredHourLabels: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      if (matrix[hour].some((count) => count > 0)) {
        filteredMatrix.push(matrix[hour]);
        filteredHourLabels.push(HeatmapChartConfig.hours[hour]);
      }
    }

    // Convert the 2D matrix to ComplexDataPoint[] for heatmap plugin compatibility
    const heatmapData = [];
    for (let i = 0; i < filteredMatrix.length; i++) {
      for (let j = 0; j < filteredMatrix[i].length; j++) {
        heatmapData.push({
          x: HeatmapChartConfig.shortDaysOfWeek[j],
          y: filteredHourLabels[i],
          v: filteredMatrix[i][j],
        });
      }
    }

    const datasets = [
      {
        label: "Kill Activity",
        data: heatmapData,
        backgroundColor: undefined, // Let the plugin handle coloring
      },
    ];

    // Create chart data
    const chartData: ChartData = {
      labels: HeatmapChartConfig.shortDaysOfWeek,
      datasets,
      displayType: "heatmap", // Custom type for heatmap
      title: `${HeatmapChartConfig.title} - ${format(
        startDate,
        "MMM d"
      )} to ${format(endDate, "MMM d, yyyy")}`,
      options: HeatmapChartConfig.heatmapOptions,
      summary: HeatmapChartConfig.getDefaultSummary(
        totalKills,
        HeatmapChartConfig.daysOfWeek[peakDay],
        HeatmapChartConfig.hours[peakHour],
        peakKills
      ),
    };

    return chartData;
  }

  /**
   * Generate a calendar-style heatmap showing activity over time
   */
  private async generateCalendarHeatmap(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Combine all character IDs from all groups
    const allCharacterIds: string[] = [];
    for (const group of characterGroups) {
      allCharacterIds.push(...group.characters.map((c) => c.eveId));
    }

    if (allCharacterIds.length === 0) {
      throw new Error("No characters found in the provided groups");
    }

    // For calendar view, we need kills grouped by date
    const killData = await this.killRepository.getKillsGroupedByTime(
      allCharacterIds,
      startDate,
      endDate,
      "day"
    );

    if (killData.length === 0) {
      throw new Error("No activity data found for the specified time period");
    }

    // Calculate totals and find peak activity
    let totalKills = 0;
    let peakKills = 0;
    let peakDate = new Date();

    for (const data of killData) {
      totalKills += data.kills;
      if (data.kills > peakKills) {
        peakKills = data.kills;
        peakDate = data.timestamp;
      }
    }

    // Format data for calendar heatmap
    const calendarData = killData.map((data) => ({
      x: format(data.timestamp, "yyyy-MM-dd"),
      y: data.timestamp.getDay(), // Day of week (0-6)
      v: data.kills, // Value (kill count)
      date: format(data.timestamp, "EEEE, MMMM d, yyyy"),
    }));

    // Create datasets
    const datasets = [
      {
        label: "Kill Activity",
        data: calendarData,
        backgroundColor: (context: any) => {
          const value = context.dataset.data[context.dataIndex].v;
          return this.getHeatmapColor(value, peakKills);
        },
      },
    ];

    // Create chart data
    const chartData: ChartData = {
      labels: HeatmapChartConfig.shortDaysOfWeek,
      datasets,
      displayType: "calendar", // Custom type for calendar heatmap
      title: `${HeatmapChartConfig.title} - ${format(
        startDate,
        "MMM d"
      )} to ${format(endDate, "MMM d, yyyy")}`,
      options: HeatmapChartConfig.calendarOptions,
      summary: HeatmapChartConfig.getDefaultSummary(
        totalKills,
        format(peakDate, "EEEE"),
        format(peakDate, "HH:mm"),
        peakKills
      ),
    };

    return chartData;
  }

  /**
   * Get color for a heatmap cell based on value intensity
   */
  private getHeatmapColor(value: number, maxValue: number): string {
    if (value === 0) return HeatmapChartConfig.colorGradient[0]; // No activity

    const normalizedValue = value / maxValue; // 0 to 1
    const gradient = HeatmapChartConfig.colorGradient;

    if (normalizedValue < 0.25) {
      return gradient[1]; // Low activity
    } else if (normalizedValue < 0.5) {
      return gradient[2]; // Medium activity
    } else if (normalizedValue < 0.75) {
      return gradient[3]; // High activity
    } else {
      return gradient[4]; // Very high activity
    }
  }
}
