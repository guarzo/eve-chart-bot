import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData } from "../../../types/chart";
import { LossChartConfig } from "../config";
import { logger } from "../../../lib/logger";
import { LossRepository } from "../../../data/repositories/LossRepository";

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
    }>;
    displayType: string;
  }): Promise<ChartData> {
    logger.info("Generating loss chart");

    const { startDate, endDate, characterGroups } = options;

    // Data arrays for chart datasets
    const filteredLabels: string[] = [];
    const totalLossesData: number[] = [];
    const highValueLossesData: number[] = [];
    const totalIskData: number[] = [];
    let grandTotalLosses = 0;
    let grandTotalValue = BigInt(0);

    // Process each character group
    for (const group of characterGroups) {
      // Convert character eveIds to bigints
      const characterIds = group.characters.map((char) => BigInt(char.eveId));

      if (characterIds.length === 0) {
        // Skip empty groups
        continue;
      }

      try {
        // Get loss data for this group
        const lossSummary =
          await this.lossRepository.getLossesSummaryByCharacters(
            characterIds,
            startDate,
            endDate
          );

        // Only include groups with at least one loss
        if (lossSummary.totalLosses > 0) {
          // Find a character with alts (main character) or use the first character
          const mainCharacter = group.characters.find((char) =>
            group.characters.some(
              (c) =>
                c.eveId !== char.eveId &&
                c.name.includes(char.name.split(" ")[0])
            )
          );
          if (mainCharacter) {
            filteredLabels.push(mainCharacter.name);
          } else if (group.characters.length > 0) {
            filteredLabels.push(group.characters[0].name);
          } else {
            filteredLabels.push(group.name); // Fallback to group name/slug
          }

          totalLossesData.push(lossSummary.totalLosses);
          highValueLossesData.push(lossSummary.highValueLosses);
          totalIskData.push(Number(lossSummary.totalValueLost));
        }

        // Update grand totals
        grandTotalLosses += lossSummary.totalLosses;
        grandTotalValue += lossSummary.totalValueLost;
      } catch (error) {
        logger.error(
          `Error fetching loss data for group ${group.name}:`,
          error
        );
      }
    }

    // Generate summary text
    const timeRangeText = this.getTimeRangeText(startDate, endDate);
    const formattedTotalValue = this.formatIsk(grandTotalValue);
    const summary = `Ship losses for tracked characters (${timeRangeText}): ${grandTotalLosses} losses totaling ${formattedTotalValue} ISK`;

    return {
      labels: filteredLabels,
      datasets: [
        {
          label: "Total Losses",
          data: totalLossesData,
          backgroundColor: this.getDatasetColors("loss").primary,
          borderColor: this.getDatasetColors("loss").primary,
        },
        {
          label: "High Value Losses",
          data: highValueLossesData,
          backgroundColor: this.getDatasetColors("loss").secondary,
          borderColor: this.getDatasetColors("loss").secondary,
        },
        {
          label: "ISK Value Lost",
          data: totalIskData,
          backgroundColor: "#FFD700",
          borderColor: "#FFD700",
        },
      ],
      title: `Ship Losses - ${timeRangeText}`,
      summary,
      displayType: "horizontalBar",
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
