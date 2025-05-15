import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData } from "../../../types/chart";
import { RatioChartConfig } from "../config";
import { logger } from "../../../lib/logger";
import { KillRepository } from "../../../data/repositories/KillRepository";
import { LossRepository } from "../../../data/repositories/LossRepository";

/**
 * Generator for kill-death ratio charts
 */
export class RatioChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;
  private lossRepository: LossRepository;

  constructor() {
    super();
    this.killRepository = new KillRepository();
    this.lossRepository = new LossRepository();
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
    }>;
    displayType: string;
  }): Promise<ChartData> {
    logger.info("Generating kill-death ratio chart");

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
    const ratioData: number[] = [];
    const efficiencyData: number[] = [];

    // Process each character group
    for (const group of characterGroups) {
      // Convert character eveIds to bigints
      const characterIds = group.characters.map((char) => BigInt(char.eveId));

      if (characterIds.length === 0) {
        // Skip empty groups
        ratioData.push(0);
        efficiencyData.push(0);
        continue;
      }

      try {
        // Get kill and loss data for this group
        const killPromises = characterIds.map(
          (charId) =>
            this.killRepository
              .getKillsForCharacter(charId.toString(), startDate, endDate)
              .then((kills) => kills.length) // Get the count of kills
        );
        const lossPromises = characterIds.map((charId) =>
          this.lossRepository.getLossesByCharacter(charId, startDate, endDate)
        );

        // Wait for all queries to complete
        const kills = await Promise.all(killPromises);
        const losses = await Promise.all(lossPromises);

        // Calculate totals
        const totalKills = kills.reduce(
          (sum: number, count: number) => sum + count,
          0
        );
        const totalLosses = losses.reduce(
          (sum: number, count: number) => sum + count,
          0
        );

        // Calculate kill-death ratio and efficiency
        let ratio = 0;
        let efficiency = 0;

        if (totalLosses > 0) {
          ratio = totalKills / totalLosses;
        } else if (totalKills > 0) {
          ratio = totalKills; // Infinite ratio capped at kill count
        }

        // Calculate efficiency (kills as percentage of total activity)
        if (totalKills + totalLosses > 0) {
          efficiency = (totalKills / (totalKills + totalLosses)) * 100;
        }

        // Add to data arrays, capping ratio at 10 for chart readability
        ratioData.push(Math.min(ratio, 10));
        efficiencyData.push(efficiency);
      } catch (error) {
        logger.error(
          `Error fetching kill-death data for group ${group.name}:`,
          error
        );
        ratioData.push(0);
        efficiencyData.push(0);
      }
    }

    // Generate summary text
    const timeRangeText = this.getTimeRangeText(startDate, endDate);
    let summary = `Kill-Death ratios for tracked characters (${timeRangeText})`;

    // Add top performer if there's data
    if (Math.max(...ratioData) > 0) {
      const bestGroupIndex = ratioData.indexOf(Math.max(...ratioData));
      summary += `\nBest performer: ${
        labels[bestGroupIndex]
      } with K/D ratio of ${ratioData[bestGroupIndex].toFixed(2)}`;
    }

    return {
      labels,
      datasets: [
        {
          label: "K/D Ratio",
          data: ratioData,
          backgroundColor: RatioChartConfig.metrics[0].color,
          borderColor: RatioChartConfig.metrics[0].color,
        },
        {
          label: "Efficiency %",
          data: efficiencyData,
          backgroundColor: RatioChartConfig.metrics[1].color,
          borderColor: RatioChartConfig.metrics[1].color,
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
