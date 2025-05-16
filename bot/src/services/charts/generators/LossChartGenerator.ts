import { BaseChartGenerator } from "../BaseChartGenerator";
import {
  ChartData,
  ChartDisplayType,
  SimpleTimeRange,
} from "../../../types/chart";
import { LossChartConfig } from "../config";
import { logger } from "../../../lib/logger";
import { LossRepository } from "../../../data/repositories/LossRepository";
import { format } from "date-fns";

interface Loss {
  killmail_id: bigint;
  labels: string[];
  character_id: bigint;
  kill_time: Date;
  ship_type_id: number;
  system_id: number;
  total_value: bigint;
  attacker_count: number;
}

/**
 * Generator for loss charts
 */
export class LossChartGenerator extends BaseChartGenerator {
  private lossRepository: LossRepository;

  constructor() {
    super();
    this.lossRepository = new LossRepository();
  }

  /**
   * Generate a loss chart
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

    // Debug: Log character IDs and time range
    logger.info(
      `[LossChart] Character IDs: ${characterIds.map(String).join(", ")}`
    );
    logger.info(
      `[LossChart] Time range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Get losses for all characters
    const timeRange: SimpleTimeRange = { start: startDate, end: endDate };
    const losses = await this.lossRepository.getLossesByTimeRange(
      characterIds.map((id) => id.toString()),
      timeRange
    );

    // Debug: Log total number of losses returned
    logger.info(
      `[LossChart] Total losses returned from repository: ${losses.length}`
    );

    // Remove duplicate killmail_ids from losses
    const seenKillmails = new Set<bigint>();
    const dedupedLosses: Loss[] = [];
    let duplicateCount = 0;
    for (const loss of losses) {
      if (!seenKillmails.has(loss.killmail_id)) {
        seenKillmails.add(loss.killmail_id);
        dedupedLosses.push(loss);
      } else {
        duplicateCount++;
      }
    }
    if (duplicateCount > 0) {
      logger.warn(
        `[LossChart] Removed ${duplicateCount} duplicate losses by killmail_id`
      );
    } else {
      logger.info(`[LossChart] No duplicate losses found by killmail_id`);
    }

    // Log unique victim character_ids
    const uniqueVictims = Array.from(
      new Set(dedupedLosses.map((loss) => loss.character_id))
    );


    // Group losses by character group
    const groupData = characterGroups.map((group) => {
      const groupCharacterIds = group.characters.map((c) => BigInt(c.eveId));
      const groupLosses = dedupedLosses.filter((loss: Loss) =>
        groupCharacterIds.includes(loss.character_id)
      );

      // Debug: Log number of losses for this group
      logger.info(
        `[LossChart] Group '${group.name}' (${group.groupId}) has ${groupLosses.length} losses`
      );

      // Calculate total losses and value
      const totalLosses = groupLosses.length;
      const totalValue = groupLosses.reduce(
        (sum: bigint, loss: Loss) => sum + loss.total_value,
        BigInt(0)
      );
      const highValueLosses = groupLosses.filter(
        (loss) => loss.total_value >= BigInt(100000000)
      ).length;

      return {
        group,
        losses: groupLosses,
        totalLosses,
        totalValue,
        highValueLosses,
      };
    });

    // Filter out groups with no losses
    const groupsWithLosses = groupData.filter((data) => data.totalLosses > 0);

    // If no groups have losses, return empty chart
    if (groupsWithLosses.length === 0) {
      logger.info("No groups with losses found, returning empty chart");
      return {
        labels: [],
        datasets: [],
        displayType: "horizontalBar" as ChartDisplayType,
        summary: "No losses found in the specified time period",
      };
    }

    // Sort groups by total value
    groupsWithLosses.sort((a, b) => {
      if (a.totalValue > b.totalValue) return -1;
      if (a.totalValue < b.totalValue) return 1;
      return 0;
    });

    // Calculate totals for summary
    const totalLosses = groupsWithLosses.reduce(
      (sum, data) => sum + data.totalLosses,
      0
    );
    const totalHighValueLosses = groupsWithLosses.reduce(
      (sum, data) => sum + data.highValueLosses,
      0
    );
    const totalIskLost = groupsWithLosses.reduce(
      (sum, data) => sum + data.totalValue,
      BigInt(0)
    );

    // Format ISK value
    const formatIsk = (value: bigint): string => {
      const valueNumber = Number(value);
      if (valueNumber >= 1_000_000_000_000) {
        return `${(valueNumber / 1_000_000_000_000).toFixed(2)}T`;
      } else if (valueNumber >= 1_000_000_000) {
        return `${(valueNumber / 1_000_000_000).toFixed(2)}B`;
      } else if (valueNumber >= 1_000_000) {
        return `${(valueNumber / 1_000_000).toFixed(2)}M`;
      } else if (valueNumber >= 1_000) {
        return `${(valueNumber / 1_000).toFixed(2)}K`;
      } else {
        return valueNumber.toString();
      }
    };

    // Create chart data
    // Round ISK lost to billions for chart
    const valueLostBillions = groupsWithLosses.map(
      (data) => +(Number(data.totalValue) / 1_000_000_000).toFixed(2)
    );

    return {
      labels: groupsWithLosses.map((data) =>
        this.getGroupDisplayName(data.group)
      ),
      datasets: [
        {
          label: "Number of Losses",
          data: groupsWithLosses.map((data) => data.totalLosses),
          backgroundColor: this.getDatasetColors("loss").secondary,
          yAxisID: "y",
          type: "bar",
        },
        {
          label: "Total Value Lost (B ISK)",
          data: valueLostBillions,
          backgroundColor: this.getDatasetColors("loss").primary + "33",
          borderColor: this.getDatasetColors("loss").primary,
          borderWidth: 2,
          tension: 0.3,
          yAxisID: "y2",
          type: "line",
        },
      ],
      displayType: "horizontalBar" as ChartDisplayType,
      options: {
        indexAxis: "y",
        scales: {
          x: {
            grid: {
              color: "#444",
            },
            ticks: {
              color: "#fff",
            },
          },
          y: {
            type: "linear",
            position: "left",
            title: {
              display: true,
              text: "Loss Count",
            },
            beginAtZero: true,
            grid: {
              color: "#444",
            },
            ticks: {
              color: "#fff",
            },
          },
          y2: {
            type: "linear",
            position: "right",
            title: {
              display: true,
              text: "ISK Lost (Billion)",
            },
            beginAtZero: true,
            grid: {
              drawOnChartArea: false,
              color: "#444",
            },
            ticks: {
              color: "#fff",
            },
          },
        },
        plugins: {
          legend: {
            position: "top",
          },
        },
      },
      summary: LossChartConfig.getDefaultSummary(
        totalLosses,
        totalHighValueLosses,
        formatIsk(totalIskLost)
      ),
    };
  }

  /**
   * Get a formatted string describing the time range
   */
  private getTimeRangeText(startDate: Date, endDate: Date): string {
    const diffDays = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays <= 1) {
      return "Last 24 hours";
    } else if (diffDays <= 7) {
      return "Last 7 days";
    } else if (diffDays <= 30) {
      return "Last 30 days";
    } else {
      return `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
    }
  }

  /**
   * Format ISK value with K, M, B suffix
   */
  private formatIsk(value: bigint): string {
    const valueNumber = Number(value);

    if (valueNumber >= 1_000_000_000_000) {
      return `${(valueNumber / 1_000_000_000_000).toFixed(2)}T`;
    } else if (valueNumber >= 1_000_000_000) {
      return `${(valueNumber / 1_000_000_000).toFixed(2)}B`;
    } else if (valueNumber >= 1_000_000) {
      return `${(valueNumber / 1_000_000).toFixed(2)}M`;
    } else if (valueNumber >= 1_000) {
      return `${(valueNumber / 1_000).toFixed(2)}K`;
    } else {
      return valueNumber.toString();
    }
  }
}
