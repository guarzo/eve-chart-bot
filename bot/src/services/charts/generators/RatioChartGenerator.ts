import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData } from "../../../types/chart";
import { logger } from "../../../lib/logger";
import { KillRepository } from "../../../infrastructure/repositories/KillRepository";
import { LossRepository } from "../../../infrastructure/repositories/LossRepository";
import { RepositoryManager } from "../../../infrastructure/repositories/RepositoryManager";

/**
 * Generator for kill-death ratio charts
 */
export class RatioChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;
  private lossRepository: LossRepository;

  /**
   * Create a new ratio chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    this.killRepository = this.repoManager.getKillRepository();
    this.lossRepository = this.repoManager.getLossRepository();
  }

  /**
   * Generate a kill-death ratio chart
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
    logger.info("Generating kill-death ratio chart");

    const { startDate, endDate, characterGroups } = options;

    // Prepare data arrays
    const filteredLabels: string[] = [];
    const kdRatios: number[] = [];
    const efficiencies: number[] = [];

    for (const group of characterGroups) {
      const characterIds = group.characters.map((char) => BigInt(char.eveId));
      if (characterIds.length === 0) continue;
      // Compute stats manually
      const kills = await this.killRepository.getKillsForCharacters(
        characterIds.map(String),
        startDate,
        endDate
      );
      const lossesSummary =
        await this.lossRepository.getLossesSummaryByCharacters(
          characterIds,
          startDate,
          endDate
        );
      const totalKills = kills.length;
      const totalLosses = lossesSummary.totalLosses;
      // Only include groups with at least one kill or death
      if (totalKills > 0 || totalLosses > 0) {
        // Use main character name if available
        let label = group.name;
        if (group.mainCharacterId) {
          const mainChar = group.characters.find(
            (c) => c.eveId === group.mainCharacterId
          );
          if (mainChar) label = mainChar.name;
        } else if (group.characters.length > 0) {
          label = group.characters[0].name;
        }
        filteredLabels.push(label);
        let kdRatio = 0;
        if (totalLosses > 0) {
          kdRatio = totalKills / totalLosses;
        } else if (totalKills > 0) {
          kdRatio = totalKills;
        }
        let efficiency = 0;
        if (totalKills + totalLosses > 0) {
          efficiency = (totalKills / (totalKills + totalLosses)) * 100;
        }
        kdRatios.push(kdRatio);
        efficiencies.push(efficiency);
      }
    }

    // Generate summary text
    const timeRangeText = this.getTimeRangeText(startDate, endDate);
    let summary = `Kill-Death ratios for tracked characters (${timeRangeText})`;

    // Add top performer if there's data
    if (Math.max(...kdRatios) > 0) {
      const bestGroupIndex = kdRatios.indexOf(Math.max(...kdRatios));
      summary += `\nBest performer: ${
        filteredLabels[bestGroupIndex]
      } with K/D ratio of ${kdRatios[bestGroupIndex].toFixed(2)}`;
    }

    return {
      labels: filteredLabels,
      datasets: [
        {
          label: "K/D Ratio",
          data: kdRatios,
          backgroundColor: "#3366CC",
          borderColor: "#3366CC",
        },
        {
          label: "Efficiency %",
          data: efficiencies,
          backgroundColor: "#DC3912",
          borderColor: "#DC3912",
        },
      ],
      title: `Kill-Death Ratio - ${timeRangeText}`,
      summary,
      displayType: "bar",
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
}
