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

    // Create display names based on main character or first character in each group
    const labels = characterGroups.map((group) => {
      // Find a character with alts (main character) or use the first character
      const mainCharacter = group.characters.find((char) =>
        group.characters.some(
          (c) =>
            c.eveId !== char.eveId && c.name.includes(char.name.split(" ")[0])
        )
      );

      // Return proper display name
      if (mainCharacter) {
        return mainCharacter.name;
      } else if (group.characters.length > 0) {
        return group.characters[0].name;
      } else {
        return group.name; // Fallback to group name/slug
      }
    });

    // Data arrays for chart datasets
    const totalLossesData: number[] = [];
    const highValueLossesData: number[] = [];
    let grandTotalLosses = 0;
    let grandTotalValue = BigInt(0);

    // Process each character group
    for (const group of characterGroups) {
      // Convert character eveIds to bigints
      const characterIds = group.characters.map((char) => BigInt(char.eveId));

      if (characterIds.length === 0) {
        // Skip empty groups
        totalLossesData.push(0);
        highValueLossesData.push(0);
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

        totalLossesData.push(lossSummary.totalLosses);
        highValueLossesData.push(lossSummary.highValueLosses);

        // Update grand totals
        grandTotalLosses += lossSummary.totalLosses;
        grandTotalValue += lossSummary.totalValueLost;
      } catch (error) {
        logger.error(
          `Error fetching loss data for group ${group.name}:`,
          error
        );
        totalLossesData.push(0);
        highValueLossesData.push(0);
      }
    }

    // Generate summary text
    const timeRangeText = this.getTimeRangeText(startDate, endDate);
    const formattedTotalValue = this.formatIsk(grandTotalValue);
    const summary = `Ship losses for tracked characters (${timeRangeText}): ${grandTotalLosses} losses totaling ${formattedTotalValue} ISK`;

    return {
      labels,
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
