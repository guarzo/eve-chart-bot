import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData } from "../../../types/chart";
import { DistributionChartConfig } from "../config";
import { KillRepository } from "../../../data/repositories";
import { format } from "date-fns";
import { logger } from "../../../lib/logger";

/**
 * Generator for kill distribution charts
 */
export class DistributionChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;

  constructor() {
    super();
    this.killRepository = new KillRepository();
  }

  /**
   * Generate a kill distribution chart based on the provided options
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
      const { startDate, endDate, characterGroups } = options;
      logger.info(
        `Generating kill distribution chart from ${startDate.toISOString()} to ${endDate.toISOString()}`
      );
      logger.debug(
        `Chart type: bar (histogram), Groups: ${characterGroups.length}`
      );
      // Always use the histogram bar chart
      return this.generateBarChart(characterGroups, startDate, endDate);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as any).message === "string" &&
        (error as any).message.includes("not found in table mapping")
      ) {
        throw new Error(
          "Distribution chart is not available: killFact model is not mapped in the database. Please contact an administrator."
        );
      }
      logger.error("Error generating distribution chart:", error);
      throw error;
    }
  }

  /**
   * Generate a bar chart showing distribution of attacker counts per kill
   */
  private async generateBarChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Get all kills with attacker counts
    const kills = await this.getAllKillAttackerCounts(
      characterGroups,
      startDate,
      endDate
    );

    // Build histogram: attackerCount -> number of kills
    const histogram: Record<number, number> = {};
    for (const kill of kills) {
      if (!histogram[kill.attackerCount]) {
        histogram[kill.attackerCount] = 0;
      }
      histogram[kill.attackerCount]++;
    }

    // Prepare sorted data for chart
    const sortedCounts = Object.keys(histogram)
      .map((k) => parseInt(k, 10))
      .sort((a, b) => a - b);
    const labels = sortedCounts.map((count) => count.toString());
    const data = sortedCounts.map((count) => histogram[count]);

    return {
      labels,
      datasets: [
        {
          label: "Kills",
          data,
          backgroundColor: "#FF7043",
          borderColor: "#FF7043",
        },
      ],
      displayType: "bar",
      title: `Kill Group Size Distribution - ${format(
        startDate,
        "MMM d"
      )} to ${format(endDate, "MMM d, yyyy")}`,
      summary: `Distribution of kills by number of attackers (group size) for the selected period.`,
      options: DistributionChartConfig.barOptions,
    };
  }

  /**
   * Helper to get all kills with attacker counts for the given groups
   */
  private async getAllKillAttackerCounts(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ killmailId: string; attackerCount: number }>> {
    const characterIds = characterGroups
      .flatMap((group) => group.characters)
      .map((character) => character.eveId);
    if (characterIds.length === 0) return [];
    return this.killRepository.getKillsWithAttackerCount(
      characterIds,
      startDate,
      endDate
    );
  }
}
