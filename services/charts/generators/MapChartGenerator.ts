import { ChartData } from "../../../types/chart";
import { MapActivityRepository } from "../../../repositories/MapActivityRepository";
import { MapChartConfig } from "../config/MapChartConfig";
import { theme } from "../config/theme";
import { logger } from "../../../utils/logger";

export class MapChartGenerator {
  constructor(private mapActivityRepository: MapActivityRepository) {}

  async generateChart(options: {
    startDate: Date;
    endDate: Date;
    characterGroups: Array<{
      id: string;
      characters: Array<{ id: string; name: string }>;
    }>;
    chartType?: "horizontal" | "vertical" | "timeline";
  }): Promise<ChartData> {
    const {
      startDate,
      endDate,
      characterGroups,
      chartType = "horizontal",
    } = options;

    logger.info("Generating map activity chart", {
      startDate,
      endDate,
      characterGroups: characterGroups.length,
      chartType,
    });

    switch (chartType) {
      case "horizontal":
        return this.generateHorizontalBarChart(
          startDate,
          endDate,
          characterGroups
        );
      case "vertical":
        return this.generateVerticalBarChart(
          startDate,
          endDate,
          characterGroups
        );
      case "timeline":
        return this.generateTimelineChart(startDate, endDate, characterGroups);
      default:
        throw new Error(`Unsupported chart type: ${chartType}`);
    }
  }

  private async generateHorizontalBarChart(
    startDate: Date,
    endDate: Date,
    characterGroups: Array<{
      id: string;
      characters: Array<{ id: string; name: string }>;
    }>
  ): Promise<ChartData> {
    const labels: string[] = [];
    const systemsData: number[] = [];
    const signaturesData: number[] = [];

    for (const group of characterGroups) {
      const displayName = group.characters[0]?.name || `Group ${group.id}`;
      labels.push(displayName);

      const stats = await this.mapActivityRepository.getMapActivityStats(
        group.characters.map((c) => c.id),
        startDate,
        endDate
      );

      if (!stats) {
        systemsData.push(0);
        signaturesData.push(0);
        continue;
      }

      systemsData.push(stats.totalSystems);
      signaturesData.push(stats.totalSignatures);
    }

    const summary = `Total Systems: ${systemsData.reduce(
      (a, b) => a + b,
      0
    )}\nTotal Signatures: ${signaturesData.reduce((a, b) => a + b, 0)}`;

    return {
      labels,
      datasets: [
        {
          label: "Systems Visited",
          data: systemsData,
          backgroundColor: theme.colors.primary,
          stack: "activity",
        },
        {
          label: "Signatures Scanned",
          data: signaturesData,
          backgroundColor: theme.colors.secondary,
          stack: "activity",
        },
      ],
      options: MapChartConfig.options.horizontal,
      summary,
    };
  }

  private async generateVerticalBarChart(
    startDate: Date,
    endDate: Date,
    characterGroups: Array<{
      id: string;
      characters: Array<{ id: string; name: string }>;
    }>
  ): Promise<ChartData> {
    const labels: string[] = [];
    const systemsData: number[] = [];
    const signaturesData: number[] = [];

    for (const group of characterGroups) {
      const displayName = group.characters[0]?.name || `Group ${group.id}`;
      labels.push(displayName);

      const stats = await this.mapActivityRepository.getMapActivityStats(
        group.characters.map((c) => c.id),
        startDate,
        endDate
      );

      if (!stats) {
        systemsData.push(0);
        signaturesData.push(0);
        continue;
      }

      systemsData.push(stats.totalSystems);
      signaturesData.push(stats.totalSignatures);
    }

    const summary = `Total Systems: ${systemsData.reduce(
      (a, b) => a + b,
      0
    )}\nTotal Signatures: ${signaturesData.reduce((a, b) => a + b, 0)}`;

    return {
      labels,
      datasets: [
        {
          label: "Systems Visited",
          data: systemsData,
          backgroundColor: theme.colors.primary,
          stack: "activity",
        },
        {
          label: "Signatures Scanned",
          data: signaturesData,
          backgroundColor: theme.colors.secondary,
          stack: "activity",
        },
      ],
      options: MapChartConfig.options.vertical,
      summary,
    };
  }

  private async generateTimelineChart(
    startDate: Date,
    endDate: Date,
    characterGroups: Array<{
      id: string;
      characters: Array<{ id: string; name: string }>;
    }>
  ): Promise<ChartData> {
    const timeGrouping = this.getTimeGrouping(startDate, endDate);
    const systemsData: Array<{ x: string; y: number }> = [];
    const signaturesData: Array<{ x: string; y: number }> = [];

    for (const group of characterGroups) {
      const stats = await this.mapActivityRepository.getMapActivityTimeline(
        group.characters.map((c) => c.id),
        startDate,
        endDate,
        timeGrouping
      );

      if (!stats) continue;

      stats.forEach((stat) => {
        systemsData.push({ x: stat.date.toISOString(), y: stat.systems });
        signaturesData.push({ x: stat.date.toISOString(), y: stat.signatures });
      });
    }

    const summary = `Showing activity from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;

    return {
      datasets: [
        {
          label: "Systems Visited",
          data: systemsData,
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primary + "40",
          fill: true,
          type: "line",
        },
        {
          label: "Signatures Scanned",
          data: signaturesData,
          borderColor: theme.colors.secondary,
          backgroundColor: theme.colors.secondary + "40",
          fill: true,
          type: "line",
        },
      ],
      options: MapChartConfig.options.timeline,
      summary,
    };
  }

  private getTimeGrouping(
    startDate: Date,
    endDate: Date
  ): "hour" | "day" | "week" {
    const diffDays =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) return "hour";
    if (diffDays <= 7) return "day";
    return "week";
  }
}
