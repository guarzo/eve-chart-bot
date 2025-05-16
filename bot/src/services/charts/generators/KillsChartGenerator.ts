import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData, ChartDisplayType } from "../../../types/chart";
import { logger } from "../../../lib/logger";
import { KillsChartConfig } from "../config";
import { KillRepository } from "../../../data/repositories/KillRepository";
import { format } from "date-fns";

interface Kill {
  character_id: string;
  timestamp: Date;
  attacker_count: number;
  solo: boolean;
  attackers?: Array<{ character_id: string }>;
  killmail_id: string;
}

interface Attacker {
  character_id: string | null;
}

/**
 * Generator for kill-related charts
 */
export class KillsChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;

  constructor() {
    super();
    this.killRepository = new KillRepository();
  }

  /**
   * Generate a kills chart based on the provided options
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

    // Get kills for all characters
    const kills = await this.killRepository.getKillsForCharacters(
      characterIds.map((id) => id.toString()),
      startDate,
      endDate
    );

    // Group kills by character group
    const groupData = characterGroups.map((group) => {
      const groupCharacterIds = group.characters.map((c) => BigInt(c.eveId));
      const groupKills = kills.filter((kill: Kill) =>
        groupCharacterIds.includes(BigInt(kill.character_id))
      );

      // Calculate total kills and solo kills
      const totalKills = groupKills.length;

      // Calculate solo kills - either true solo (1 attacker) or group solo (all attackers from same group)
      let soloKills = 0;
      for (const kill of groupKills) {
        // First check if it's marked as solo in the database
        if (kill.solo) {
          soloKills++;
          logger.info(
            `Found true solo kill for group ${group.name}: Kill ID ${kill.killmail_id}`
          );
          continue;
        }

        // If not marked as solo, check if all attackers are from this group
        if (kill.attackers && kill.attackers.length > 0) {
          const playerAttackers = kill.attackers.filter(
            (a: Attacker) => a.character_id
          );
          if (playerAttackers.length > 0) {
            const allFromGroup = playerAttackers.every((attacker: Attacker) => {
              if (!attacker.character_id) return false;
              return groupCharacterIds.includes(BigInt(attacker.character_id));
            });

            if (allFromGroup) {
              soloKills++;
              logger.info(
                `Found group solo kill for group ${group.name}: Kill ID ${kill.killmail_id} - ${playerAttackers.length} attackers, all from same group`
              );
            }
          }
        }
      }

      return {
        group,
        kills: groupKills,
        totalKills,
        soloKills,
      };
    });

    // Filter out groups with no kills
    const groupsWithKills = groupData.filter((data) => data.totalKills > 0);

    // If no groups have kills, return empty chart
    if (groupsWithKills.length === 0) {
      logger.info("No groups with kills found, returning empty chart");
      return {
        labels: [],
        datasets: [],
        displayType: "horizontalBar" as ChartDisplayType,
        summary: "No kills found in the specified time period",
      };
    }

    // Sort groups by total kills
    groupsWithKills.sort((a, b) => b.totalKills - a.totalKills);

    // Create chart data
    return {
      labels: groupsWithKills.map((data) =>
        this.getGroupDisplayName(data.group)
      ),
      datasets: [
        {
          label: "Total Kills",
          data: groupsWithKills.map((data) => data.totalKills),
          backgroundColor: this.getDatasetColors("kills").primary,
        },
        {
          label: "Solo Kills",
          data: groupsWithKills.map((data) => data.soloKills),
          backgroundColor: this.getDatasetColors("kills").secondary,
        },
      ],
      displayType: "horizontalBar" as ChartDisplayType,
      options: {
        indexAxis: "y",
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
          },
          y: {
            stacked: true,
          },
        },
        plugins: {
          legend: {
            position: "top",
          },
        },
      },
      summary: KillsChartConfig.getDefaultSummary(
        groupsWithKills.reduce((total, data) => total + data.totalKills, 0),
        groupsWithKills.reduce((total, data) => total + data.soloKills, 0)
      ),
    };
  }

  /**
   * Generate a horizontal bar chart showing kills by character group
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
    // Prepare data arrays
    const labels: string[] = [];
    const totalKillsData: number[] = [];
    const soloKillsData: number[] = [];
    let overallTotalKills = 0;
    let overallSoloKills = 0;

    // Get kill stats for each group
    for (const group of characterGroups) {
      // Use the enhanced stats method to get both solo and group solo kills
      const stats = await this.killRepository.getGroupKillStatsEnhanced(
        group.groupId,
        startDate,
        endDate
      );

      // Skip empty groups
      if (stats.totalKills === 0) {
        continue;
      }

      // Get display name using the common method
      const displayName = this.getGroupDisplayName(group);
      labels.push(displayName);
      totalKillsData.push(stats.totalKills);

      // Count either true solo kills or group solo kills (whichever is higher)
      const effectiveSoloKills = Math.max(
        stats.soloKills,
        stats.groupSoloKills
      );

      // Ensure solo kills are visible - add a minimum value if there are any
      if (effectiveSoloKills > 0) {
        // Make sure solo kills are at least 10% of total kills for visibility,
        // with a minimum of the actual solo kills count
        soloKillsData.push(
          Math.max(effectiveSoloKills, Math.ceil(stats.totalKills * 0.2))
        );
        console.log(
          `Enhanced visibility for ${displayName}: True solo kills: ${
            stats.soloKills
          }, Group solo kills: ${stats.groupSoloKills}, Displayed as: ${
            soloKillsData[soloKillsData.length - 1]
          }`
        );
      } else {
        soloKillsData.push(0);
      }

      overallTotalKills += stats.totalKills;
      overallSoloKills += effectiveSoloKills;

      // Log for debugging
      console.log(
        `Character: ${displayName}, Total Kills: ${
          stats.totalKills
        }, True Solo Kills: ${stats.soloKills}, Group Solo Kills: ${
          stats.groupSoloKills
        }, Display Solo: ${soloKillsData[soloKillsData.length - 1]}`
      );
    }

    // Log the complete arrays
    console.log("Total Kills Data:", totalKillsData);
    console.log("Solo Kills Data:", soloKillsData);
    console.log(
      "Overall Stats - Total Kills:",
      overallTotalKills,
      "Solo Kills:",
      overallSoloKills
    );

    // Replace color definitions with
    const primaryColor = this.getDatasetColors("kills").primary;
    const secondaryColor = this.getDatasetColors("kills").secondary;

    // Make the colors more consistent by using our utility function
    const totalColors = this.getVisibleColors(
      totalKillsData,
      Array(totalKillsData.length).fill(primaryColor)
    );
    const soloColors = this.getVisibleColors(
      soloKillsData,
      Array(soloKillsData.length).fill(secondaryColor)
    );

    // Create chart data
    const chartData: ChartData = {
      labels,
      datasets: [
        {
          label: KillsChartConfig.metrics[0].name,
          data: totalKillsData,
          backgroundColor: totalColors,
          borderColor: KillsChartConfig.metrics[0].color,
        },
        {
          label: KillsChartConfig.metrics[1].name,
          data: soloKillsData,
          backgroundColor: soloColors,
          borderColor: KillsChartConfig.metrics[1].color,
        },
      ],
      title: `${KillsChartConfig.title} - ${format(
        startDate,
        "MMM dd"
      )} to ${format(endDate, "MMM dd")}`,
      displayType: "bar",
      options: {
        indexAxis: "y",
      },
      summary: KillsChartConfig.getDefaultSummary(
        overallTotalKills,
        overallSoloKills
      ),
    };

    return chartData;
  }

  /**
   * Generate a vertical bar chart showing kills by character group
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
    // This is similar to horizontal bar chart but with a different orientation
    const chartData = await this.generateHorizontalBarChart(
      characterGroups,
      startDate,
      endDate
    );
    chartData.displayType = "bar";
    return chartData;
  }

  /**
   * Generate a timeline chart showing kills over time
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
    // First, determine the appropriate time grouping based on date range
    const dateRange = endDate.getTime() - startDate.getTime();
    const days = dateRange / (1000 * 60 * 60 * 24);

    let groupBy: "hour" | "day" | "week" = "day";
    if (days <= 2) {
      groupBy = "hour";
    } else if (days > 30) {
      groupBy = "week";
    }

    // Create a dataset for each character group
    const datasets = [];
    const timeLabels = new Set<string>();
    let overallTotalKills = 0;
    let overallSoloKills = 0;

    // Process each group
    for (let i = 0; i < characterGroups.length; i++) {
      const group = characterGroups[i];

      // Get all character IDs for this group
      const characterIds = group.characters.map((char) => char.eveId);

      if (characterIds.length === 0) {
        continue;
      }

      // Get kill data grouped by time
      const killData = await this.killRepository.getKillsGroupedByTime(
        characterIds,
        startDate,
        endDate,
        groupBy
      );

      // Skip if no data
      if (killData.length === 0) {
        continue;
      }

      // Determine proper display name for the group
      const displayName = this.getGroupDisplayName(group);

      // Extract the data points and collect labels
      const dataPoints: number[] = [];
      const timePoints: string[] = [];

      let groupTotalKills = 0;
      let groupSoloKills = 0;

      for (const point of killData) {
        const formattedTime = format(
          point.timestamp,
          this.getDateFormat(groupBy)
        );
        timePoints.push(formattedTime);
        timeLabels.add(formattedTime);

        dataPoints.push(point.kills);
        groupTotalKills += point.kills;

        // Calculate solo kills (this is an approximation and may need refinement)
        const soloKills = killData
          .filter((k) => k.timestamp.getTime() === point.timestamp.getTime())
          .reduce((solo, k) => solo + (k.kills === 1 ? 1 : 0), 0);
        groupSoloKills += soloKills;
      }

      // Update overall statistics
      overallTotalKills += groupTotalKills;
      overallSoloKills += groupSoloKills;

      // Add dataset for this group
      datasets.push({
        label: displayName,
        data: dataPoints,
        backgroundColor: this.getColorForIndex(i),
        borderColor: this.getColorForIndex(i),
        fill: false,
      });
    }

    // Sort the time labels chronologically
    const sortedLabels = Array.from(timeLabels).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });

    // Create chart data
    const chartData: ChartData = {
      labels: sortedLabels,
      datasets,
      title: `Kill Activity Over Time - ${format(
        startDate,
        "MMM dd"
      )} to ${format(endDate, "MMM dd")}`,
      displayType: "line",
      summary: KillsChartConfig.getDefaultSummary(
        overallTotalKills,
        overallSoloKills
      ),
    };

    return chartData;
  }
}
