import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData, ChartDisplayType } from "../../../types/chart";
import { logger } from "../../../lib/logger";
import { KillsChartConfig } from "../config";
import { KillRepository } from "../../../data/repositories/KillRepository";

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
    const { startDate, endDate, characterGroups } = options;

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
}
