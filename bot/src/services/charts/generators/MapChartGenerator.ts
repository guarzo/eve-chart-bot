import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData } from "../../../types/chart";
import { MapActivityRepository } from "../../../data/repositories";
import { format } from "date-fns";
import { logger } from "../../../lib/logger";

/**
 * Generator for map activity charts
 */
export class MapChartGenerator extends BaseChartGenerator {
  private mapActivityRepository: MapActivityRepository;

  constructor(mapActivityRepository: MapActivityRepository) {
    super();
    this.mapActivityRepository = mapActivityRepository;
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
      mainCharacterId?: string;
    }>;
    displayType: string;
  }): Promise<ChartData> {
    try {
      const { startDate, endDate, characterGroups, displayType } = options;
      logger.info(
        `Generating map activity chart from ${startDate.toISOString()} to ${endDate.toISOString()}`
      );
      logger.debug(
        `Chart type: ${displayType}, Groups: ${characterGroups.length}`
      );

      switch (displayType) {
        case "bar":
          return this.generateVerticalBarChart(
            characterGroups,
            startDate,
            endDate
          );
        case "line":
          return this.generateTimelineChart(
            characterGroups,
            startDate,
            endDate
          );
        default:
          return this.generateHorizontalBarChart(
            characterGroups,
            startDate,
            endDate
          );
      }
    } catch (error) {
      logger.error("Error generating map activity chart:", error);
      throw error;
    }
  }

  /**
   * Generate a horizontal bar chart showing map activity by character
   */
  private async generateHorizontalBarChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Get activity data for each group
    const activityData = await Promise.all(
      characterGroups.map(async (group) => {
        const stats = await this.mapActivityRepository.getGroupActivityStats(
          group.groupId,
          startDate,
          endDate
        );
        return {
          groupName: group.name,
          systems: stats.totalSystems,
          signatures: stats.totalSignatures,
        };
      })
    );

    // Sort by total activity
    activityData.sort(
      (a, b) => b.systems + b.signatures - (a.systems + a.signatures)
    );

    return {
      labels: activityData.map((data) => data.groupName),
      datasets: [
        {
          label: "Systems Visited",
          data: activityData.map((data) => data.systems),
          backgroundColor: "#3366CC",
        },
        {
          label: "Signatures Scanned",
          data: activityData.map((data) => data.signatures),
          backgroundColor: "#DC3912",
        },
      ],
      displayType: "horizontalBar",
      title: `Map Activity - ${format(startDate, "MMM d")} to ${format(
        endDate,
        "MMM d, yyyy"
      )}`,
      summary: `Map activity statistics for the selected period.`,
    };
  }

  /**
   * Generate a vertical bar chart showing map activity by character
   */
  private async generateVerticalBarChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    const chartData = await this.generateHorizontalBarChart(
      characterGroups,
      startDate,
      endDate
    );
    return {
      ...chartData,
      displayType: "bar",
    };
  }

  /**
   * Generate a timeline chart showing map activity over time
   */
  private async generateTimelineChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    const timeGrouping = this.getTimeGrouping(startDate, endDate);
    const characterIds = characterGroups.flatMap((group) =>
      group.characters.map((c) => c.eveId)
    );

    const activityData =
      await this.mapActivityRepository.getActivityGroupedByTime(
        characterIds,
        startDate,
        endDate,
        timeGrouping
      );

    return {
      labels: activityData.map((period) =>
        format(period.timestamp, "MMM d, HH:mm")
      ),
      datasets: [
        {
          label: "Systems Visited",
          data: activityData.map((period) => period.systems),
          borderColor: "#3366CC",
          backgroundColor: "#3366CC33",
          fill: true,
        },
        {
          label: "Signatures Scanned",
          data: activityData.map((period) => period.signatures),
          borderColor: "#DC3912",
          backgroundColor: "#DC391233",
          fill: true,
        },
      ],
      displayType: "line",
      title: `Map Activity Timeline - ${format(startDate, "MMM d")} to ${format(
        endDate,
        "MMM d, yyyy"
      )}`,
      summary: `Map activity over time, grouped by ${timeGrouping}.`,
    };
  }

  /**
   * Determine appropriate time grouping based on date range
   */
  private getTimeGrouping(
    startDate: Date,
    endDate: Date
  ): "hour" | "day" | "week" {
    const diffDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays <= 7) return "hour";
    if (diffDays <= 31) return "day";
    return "week";
  }
}
