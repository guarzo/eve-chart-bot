import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData, ChartDisplayType } from "../../../types/chart";
import { MapActivityRepository } from "../../../data/repositories/MapActivityRepository";
import { format } from "date-fns";
import { logger } from "../../../lib/logger";

interface MapActivity {
  allianceId: number | null;
  corporationId: number;
  timestamp: Date;
  characterId: bigint;
  signatures: number;
  connections: number;
  passages: number;
}

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
      mainCharacterId?: string;
    }>;
    displayType: string;
  }): Promise<ChartData> {
    const { startDate, endDate, characterGroups, displayType } = options;

    // Get all character IDs from all groups
    const characterIds = characterGroups.flatMap((group) =>
      group.characters.map((c) => BigInt(c.eveId))
    );

    // Get map activity for all characters
    const activities =
      await this.mapActivityRepository.getActivityForCharacters(
        characterIds.map((id) => id.toString()),
        startDate,
        endDate
      );

    // Group activities by character group
    const groupData = characterGroups.map((group) => {
      const groupCharacterIds = group.characters.map((c) => BigInt(c.eveId));
      const groupActivities = activities.filter((activity: MapActivity) =>
        groupCharacterIds.includes(activity.characterId)
      );

      // Calculate totals for each metric
      const totalSignatures = groupActivities.reduce(
        (sum: number, activity: MapActivity) => sum + activity.signatures,
        0
      );
      const totalConnections = groupActivities.reduce(
        (sum: number, activity: MapActivity) => sum + activity.connections,
        0
      );
      const totalPassages = groupActivities.reduce(
        (sum: number, activity: MapActivity) => sum + activity.passages,
        0
      );

      return {
        group,
        activities: groupActivities,
        totalSignatures,
        totalConnections,
        totalPassages,
      };
    });

    // Sort groups by total activity (sum of all metrics)
    groupData.sort(
      (a, b) =>
        b.totalSignatures +
        b.totalConnections +
        b.totalPassages -
        (a.totalSignatures + a.totalConnections + a.totalPassages)
    );

    // Create chart data
    return {
      labels: groupData.map((data) => this.getGroupDisplayName(data.group)),
      datasets: [
        {
          label: "Signatures",
          data: groupData.map((data) => data.totalSignatures),
          backgroundColor: this.getDatasetColors("map").primary,
        },
        {
          label: "Connections",
          data: groupData.map((data) => data.totalConnections),
          backgroundColor: this.getDatasetColors("map").secondary,
        },
        {
          label: "Passages",
          data: groupData.map((data) => data.totalPassages),
          backgroundColor: this.getColorForIndex(2),
        },
      ],
      displayType: "horizontalBar" as ChartDisplayType,
    };
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
        const characterIds = group.characters.map((char) => char.eveId);
        // Join character IDs into a single string for the repository method
        const activity = await this.mapActivityRepository.getGroupActivityStats(
          characterIds.join(","),
          startDate,
          endDate
        );

        return {
          group,
          systems: activity.totalSystems,
          signatures: activity.totalSignatures,
        };
      })
    );

    // Filter out groups with no activity
    const filteredData = activityData.filter(
      (data) => data.systems > 0 || data.signatures > 0
    );

    // Sort by total activity
    filteredData.sort(
      (a, b) => b.systems + b.signatures - (a.systems + a.signatures)
    );

    return {
      labels: filteredData.map((data) => this.getGroupDisplayName(data.group)),
      datasets: [
        {
          label: "Systems Visited",
          data: filteredData.map((data) => data.systems),
          backgroundColor: "#3366CC",
        },
        {
          label: "Signatures Scanned",
          data: filteredData.map((data) => data.signatures),
          backgroundColor: "#DC3912",
        },
      ],
      displayType: "bar",
      options: {
        indexAxis: "y",
        scales: {
          x: { stacked: true },
          y: { stacked: true },
        },
      },
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
