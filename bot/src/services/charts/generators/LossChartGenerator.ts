import { BaseChartGenerator } from "../BaseChartGenerator";
import {
  ChartData,
  ChartDisplayType
} from "../../../types/chart";
import { LossChartConfig } from "../config";
import { logger } from "../../../lib/logger";
import { LossRepository } from "../../../infrastructure/repositories/LossRepository";
import { RepositoryManager } from "../../../infrastructure/repositories/RepositoryManager";
import { LossFact } from "../../../domain/killmail/LossFact";

/**
 * Generator for loss charts
 */
export class LossChartGenerator extends BaseChartGenerator {
  private lossRepository: LossRepository;

  /**
   * Create a new loss chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    this.lossRepository = this.repoManager.getLossRepository();
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
    const { startDate, endDate, characterGroups } = options;

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
    const losses = await this.lossRepository.getLossesByTimeRange(
      startDate,
      endDate
    );

    // Debug: Log total number of losses returned
    logger.info(
      `[LossChart] Total losses returned from repository: ${losses.length}`
    );

    // Remove duplicate killmail_ids from losses
    const seenKillmails = new Set<bigint>();
    const dedupedLosses: LossFact[] = [];
    let duplicateCount = 0;
    for (const loss of losses) {
      if (!seenKillmails.has(loss.killmailId)) {
        seenKillmails.add(loss.killmailId);
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

    // Group losses by character group
    const groupData = characterGroups.map((group) => {
      const groupCharacterIds = group.characters.map((c) => BigInt(c.eveId));
      const groupLosses = dedupedLosses.filter((loss: LossFact) =>
        groupCharacterIds.includes(loss.characterId)
      );

      // Debug: Log number of losses for this group
      logger.info(
        `[LossChart] Group '${group.name}' (${group.groupId}) has ${groupLosses.length} losses`
      );

      // Calculate total losses and value
      const totalLosses = groupLosses.length;
      const totalValue = groupLosses.reduce(
        (sum: bigint, loss: LossFact) => sum + loss.totalValue,
        BigInt(0)
      );
      const highValueLosses = groupLosses.filter(
        (loss) => loss.totalValue >= BigInt(100000000)
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
   * Generate a chart showing daily losses over time
   * @param start Start date for the chart
   * @param end End date for the chart
   */
  async generateDailyLossesChart(
    start: string,
    end: string
  ): Promise<ChartData> {
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Get losses for the time range
    const losses = await this.lossRepository.getLossesByTimeRange(
      startDate,
      endDate
    );

    // Group losses by day
    const groupedLosses = losses.reduce((acc, loss) => {
      const date = loss.killTime.toISOString().split("T")[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(loss);
      return acc;
    }, {} as Record<string, LossFact[]>);

    // Calculate daily totals
    const data = Object.entries(groupedLosses).map(([date, dayLosses]) => ({
      date,
      value: dayLosses.reduce((sum, loss) => sum + Number(loss.totalValue), 0),
      count: dayLosses.length,
    }));

    // Sort by date
    data.sort((a, b) => a.date.localeCompare(b.date));

    return {
      title: "Daily Losses",
      labels: data.map((d) => d.date),
      datasets: [
        {
          label: "Total Value Lost (ISK)",
          data: data.map((d) => d.value),
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          borderColor: "rgb(255, 99, 132)",
        },
        {
          label: "Number of Losses",
          data: data.map((d) => d.count),
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          borderColor: "rgb(54, 162, 235)",
        },
      ],
      displayType: "line" as ChartDisplayType,
    };
  }

  /**
   * Generate a chart showing losses by ship type
   * @param start Start date for the chart
   * @param end End date for the chart
   */
  async generateShipTypeLossesChart(
    start: string,
    end: string
  ): Promise<ChartData> {
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Get losses for the time range
    const losses = await this.lossRepository.getLossesByTimeRange(
      startDate,
      endDate
    );

    // Group losses by ship type
    const groupedLosses = losses.reduce((acc, loss) => {
      if (!acc[loss.shipTypeId]) {
        acc[loss.shipTypeId] = [];
      }
      acc[loss.shipTypeId].push(loss);
      return acc;
    }, {} as Record<number, LossFact[]>);

    // Calculate totals by ship type
    const data = Object.entries(groupedLosses).map(
      ([shipTypeId, shipLosses]) => ({
        shipTypeId: Number(shipTypeId),
        value: shipLosses.reduce(
          (sum, loss) => sum + Number(loss.totalValue),
          0
        ),
        count: shipLosses.length,
      })
    );

    // Sort by value
    data.sort((a, b) => b.value - a.value);

    return {
      title: "Losses by Ship Type",
      labels: data.map((d) => `Ship Type ${d.shipTypeId}`),
      datasets: [
        {
          label: "Total Value Lost (ISK)",
          data: data.map((d) => d.value),
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          borderColor: "rgb(255, 99, 132)",
        },
        {
          label: "Number of Losses",
          data: data.map((d) => d.count),
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          borderColor: "rgb(54, 162, 235)",
        },
      ],
      displayType: "bar" as ChartDisplayType,
    };
  }
}
