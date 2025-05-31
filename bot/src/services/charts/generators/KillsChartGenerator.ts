import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData, ChartDisplayType } from "../../../types/chart";
import { logger } from "../../../lib/logger";
import { KillsChartConfig } from "../config";
import { KillRepository } from "../../../infrastructure/repositories/KillRepository";
import { RepositoryManager } from "../../../infrastructure/repositories/RepositoryManager";

interface Kill {
  killmailId: bigint;
  killTime: Date;
  victim?: { characterId?: bigint };
  attackers?: Array<{ characterId?: bigint }>;
  solo: boolean;
  [key: string]: any; // For other properties
}

interface Attacker {
  characterId?: bigint;
}

/**
 * Generator for kill-related charts
 */
export class KillsChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;

  /**
   * Create a new kills chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    this.killRepository = this.repoManager.getKillRepository();
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

    logger.info(
      `KillsChartGenerator: Processing ${characterGroups.length} character groups`
    );
    logger.info(
      `Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Get all character IDs from all groups
    const characterIds = characterGroups.flatMap((group) =>
      group.characters.map((c) => BigInt(c.eveId))
    );

    logger.info(`Total characters across all groups: ${characterIds.length}`);

    // Get kills for all characters - use the new method that includes participation as attackers
    const kills = await this.killRepository.getAllKillsForCharacters(
      characterIds.map((id) => id.toString()),
      startDate,
      endDate
    );

    logger.info(
      `Found ${kills.length} total kills across all characters (including as attackers)`
    );

    // Debug: Log the first few kills to see their structure
    if (kills.length > 0) {
      logger.info("Sample kill data structure:");
      kills.slice(0, 3).forEach((kill, index) => {
        logger.info(`Kill ${index + 1}:`);
        logger.info(
          `  killmailId: ${kill.killmailId} (type: ${typeof kill.killmailId})`
        );
        logger.info(
          `  victim.characterId: ${
            kill.victim?.characterId
          } (type: ${typeof kill.victim?.characterId})`
        );
        logger.info(`  attackers_count: ${kill.attackers?.length || 0}`);
        logger.info(`  all_keys: ${Object.keys(kill).join(", ")}`);
        if (kill.attackers?.[0]) {
          logger.info(
            `  first_attacker.characterId: ${
              kill.attackers[0].characterId
            } (type: ${typeof kill.attackers[0].characterId})`
          );
        }
      });
    }

    // Debug: Log character IDs we're looking for
    logger.info(
      `Character IDs we're looking for: ${characterIds
        .slice(0, 5)
        .map((id) => id.toString())
        .join(", ")}`
    );

    // Log distribution of kills across characters
    const killsByCharacter = new Map<string, number>();
    kills.forEach((kill) => {
      // Count kills by attackers (those who participated in the kill)
      if (kill.attackers) {
        kill.attackers.forEach((attacker: any) => {
          if (attacker.characterId != null) {
            const charId = attacker.characterId.toString();
            killsByCharacter.set(
              charId,
              (killsByCharacter.get(charId) || 0) + 1
            );
          }
        });
      }
    });

    logger.info(
      `Kill distribution: ${killsByCharacter.size} characters have kills as main killer`
    );
    logger.info(
      `Characters with most kills as main: ${Array.from(
        killsByCharacter.entries()
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([charId, count]) => `${charId}:${count}`)
        .join(", ")}`
    );

    // Group kills by character group, but now include any kill where a group member is on the killmail
    const groupData = characterGroups.map((group) => {
      const groupName = this.getGroupDisplayName(group);
      const groupCharacterIds = group.characters.map((c) => BigInt(c.eveId));

      // Use a Set to track unique killmail IDs to avoid double-counting
      const uniqueGroupKillIds = new Set<string>();

      // A kill belongs to the group if:
      // 1. The main character on the kill is in the group, OR
      // 2. Any of the attackers are in the group
      kills.forEach((kill: Kill) => {
        const killmailIdStr = kill.killmailId?.toString();
        if (!killmailIdStr) return;

        // Skip if we've already counted this killmail
        if (uniqueGroupKillIds.has(killmailIdStr)) {
          return;
        }

        // Debug for first group only to avoid spam
        const isFirstGroup = group === characterGroups[0];

        // Check if any attackers are in group (kills are attributed to attackers)
        if (kill.attackers && kill.attackers.length > 0) {
          for (const attacker of kill.attackers) {
            if (!attacker.characterId) continue;

            const attackerCharId = BigInt(attacker.characterId);
            if (groupCharacterIds.includes(attackerCharId)) {
              if (isFirstGroup && kills.indexOf(kill) < 3) {
                logger.info(
                  `Found attacker match in kill ${killmailIdStr}: attacker=${attacker.characterId}`
                );
              }
              uniqueGroupKillIds.add(killmailIdStr);
              return;
            }
          }
        }

        // Also check if victim is in group (for loss tracking)
        if (kill.victim?.characterId != null) {
          const victimCharId = BigInt(kill.victim.characterId);
          const isVictimInGroup = groupCharacterIds.includes(victimCharId);

          if (isFirstGroup && kills.indexOf(kill) < 3) {
            logger.info(
              `Checking kill ${killmailIdStr}: victim=${kill.victim.characterId}, isInGroup=${isVictimInGroup}`
            );
          }

          if (isVictimInGroup) {
            uniqueGroupKillIds.add(killmailIdStr);
            return;
          }
        }
      });

      // Now get the actual kill objects for the unique IDs
      const groupKills = kills.filter((kill: Kill) => {
        const killmailIdStr = kill.killmailId?.toString();
        return killmailIdStr && uniqueGroupKillIds.has(killmailIdStr);
      });

      // Calculate total kills using the unique count
      const totalKills = uniqueGroupKillIds.size;

      logger.info(
        `Group ${groupName}: ${totalKills} unique kills, ${group.characters.length} characters`
      );

      if (groupKills.length > 0) {
        // List the first few character IDs that have kills in this group
        const characterIdsWithKills = new Set<string>();
        groupKills.forEach((kill) => {
          if (kill.attackers) {
            kill.attackers.forEach((attacker: any) => {
              if (attacker.characterId != null) {
                characterIdsWithKills.add(attacker.characterId.toString());
              }
            });
          }
        });
        logger.info(
          `Characters with kills in group ${groupName}: ${Array.from(
            characterIdsWithKills
          )
            .slice(0, 3)
            .join(", ")}${characterIdsWithKills.size > 3 ? "..." : ""} (${
            characterIdsWithKills.size
          } total)`
        );
      }

      // Calculate solo kills - either true solo (1 attacker) or group solo (all attackers from same group)
      let soloKills = 0;
      for (const kill of groupKills) {
        // Skip kills with no attackers
        if (!kill.attackers || kill.attackers.length === 0) continue;

        // Get all player attackers (those with character IDs)
        const playerAttackers = kill.attackers.filter(
          (a: Attacker) => a.characterId != null
        );
        if (playerAttackers.length === 0) continue;

        // Count as solo if either:
        // 1. It's a true solo kill (only one player attacker)
        // 2. All player attackers are from this group
        const isTrueSolo = playerAttackers.length === 1;
        const allFromGroup = playerAttackers.every((attacker: Attacker) => {
          if (!attacker.characterId) return false;
          return groupCharacterIds.includes(BigInt(attacker.characterId));
        });

        if (isTrueSolo || allFromGroup) {
          soloKills++;
          const killmailIdStr = kill.killmailId?.toString() || "unknown";
          logger.info(
            `Found ${
              isTrueSolo ? "true" : "group"
            } solo kill for group ${groupName}: Kill ID ${killmailIdStr} - ${
              playerAttackers.length
            } player attackers`
          );
        }
      }

      return {
        group,
        kills: groupKills,
        totalKills,
        soloKills,
      };
    });

    // Log all group data before filtering
    groupData.forEach((data) => {
      const groupName = this.getGroupDisplayName(data.group);
      logger.info(
        `Group ${groupName}: ${data.totalKills} total kills, ${data.soloKills} solo kills`
      );
    });

    // Filter out groups with no kills
    const groupsWithKills = groupData.filter((data) => data.totalKills > 0);

    logger.info(
      `Filtered to ${groupsWithKills.length} groups with kills out of ${groupData.length} total groups`
    );

    // List the groups that were filtered out
    const filteredOutGroups = groupData
      .filter((data) => data.totalKills === 0)
      .map((data) => this.getGroupDisplayName(data.group));

    if (filteredOutGroups.length > 0) {
      logger.info(
        `Groups with no kills: ${filteredOutGroups.slice(0, 5).join(", ")}${
          filteredOutGroups.length > 5 ? "..." : ""
        } (${filteredOutGroups.length} total)`
      );
    }

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

    logger.info(
      `Top 5 groups by kill count: ${groupsWithKills
        .slice(0, 5)
        .map((g) => `${this.getGroupDisplayName(g.group)}: ${g.totalKills}`)
        .join(", ")}`
    );

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
