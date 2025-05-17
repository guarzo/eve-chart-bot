import { PrismaClient } from "@prisma/client";
import {
  ChartConfigInput,
  ChartData,
  ChartDisplayType,
  ChartMetric,
} from "../types/chart";
import { format } from "date-fns";
import { logger } from "../lib/logger";

interface KillData {
  killTime: Date;
  totalValue: bigint;
  points: number;
  attackerCount: number;
  characters: Array<{ characterId: string }>;
}

interface ActivityData {
  timestamp: Date;
  signatures: number;
  characterId: string;
}

export class ChartService {
  private prisma: PrismaClient;
  private colors: string[] = [
    "#3366CC", // deep blue
    "#DC3912", // red
    "#FF9900", // orange
    "#109618", // green
    "#990099", // purple
    "#0099C6", // teal
    "#DD4477", // pink
    "#66AA00", // lime
    "#B82E2E", // dark red
    "#316395", // navy
    "#994499", // violet
    "#22AA99", // seafoam
    "#AAAA11", // olive
    "#6633CC", // indigo
    "#E67300", // amber
    "#8B0707", // maroon
  ];

  constructor() {
    this.prisma = new PrismaClient();
  }

  async generateChart(config: ChartConfigInput): Promise<ChartData> {
    const {
      type,
      characterIds,
      period,
      groupBy = "hour",
      displayType = "line",
      displayMetric = "value", // Default to value, but can be "kills", "value", "points", "attackers"
      limit = 10, // Limit number of characters to display
    } = config;

    // Calculate start date based on period
    const startDate = new Date();
    switch (period) {
      case "24h":
        startDate.setHours(startDate.getHours() - 24);
        break;
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        throw new Error(`Invalid period: ${period}`);
    }

    // Generate chart title
    const metricLabel =
      displayMetric === "value"
        ? "ISK Value"
        : displayMetric === "kills"
        ? "Kill Count"
        : displayMetric === "points"
        ? "Points"
        : "Attacker Count";

    const chartTitle = `${
      type === "kills" ? "Kills" : "Map Activity"
    } - ${metricLabel} - Last ${
      period === "24h"
        ? "24 Hours"
        : period === "7d"
        ? "7 Days"
        : period === "30d"
        ? "30 Days"
        : "90 Days"
    }`;

    // Generate chart based on type
    let chartData;
    switch (type) {
      case "kills":
        chartData = await this.generateKillsChart(
          characterIds,
          startDate,
          groupBy,
          displayMetric,
          limit
        );
        break;
      case "map_activity":
        chartData = await this.generateMapActivityChart(
          characterIds,
          startDate,
          groupBy
        );
        break;
      default:
        throw new Error(`Invalid chart type: ${type}`);
    }

    // Add title and displayType to chart data
    chartData.title = chartTitle;
    chartData.displayType = displayType;

    return chartData;
  }

  private async generateKillsChart(
    characterIds: bigint[],
    startDate: Date,
    groupBy: "hour" | "day" | "week",
    displayMetric: ChartMetric = "value",
    limit: number = 10
  ): Promise<ChartData> {
    // Convert character IDs to strings for query
    const characterIdStrings = characterIds.map((id) => id.toString());

    logger.info(
      `Generating kills chart for ${
        characterIds.length
      } characters from ${startDate.toISOString()}`
    );
    logger.info(`Character IDs: ${characterIdStrings.join(", ")}`);

    try {
      // First, get all characters including alts for the requested main characters
      const allCharacters = await this.prisma.character.findMany({
        where: {
          OR: [
            { eveId: { in: characterIdStrings } }, // Main characters
            { mainCharacterId: { in: characterIdStrings } }, // Alt characters
          ],
        },
      });

      const allCharacterIds = allCharacters.map((c) => BigInt(c.eveId));
      logger.info(
        `Including all characters and alts: ${allCharacters.length} characters total`
      );

      // Get kills for each character using the updated schema
      logger.info("Querying killFact table with expanded character list...");
      const killsQuery = await this.prisma.killFact.findMany({
        where: {
          character_id: {
            in: allCharacterIds,
          },
          kill_time: { gte: startDate },
        },
        orderBy: { kill_time: "asc" },
      });

      logger.info(`Found ${killsQuery.length} kill records in database`);

      if (killsQuery.length === 0) {
        logger.warn(
          "No kills found for the specified characters and time period"
        );
        // Return empty chart data but with datasets for the requested characters
        const emptyDatasets = await Promise.all(
          characterIds.slice(0, limit).map(async (characterId, index) => {
            // Try to get character name
            try {
              const character = await this.prisma.character.findUnique({
                where: { eveId: characterId.toString() },
              });

              return {
                label: character?.name || `Character ${characterId}`,
                data: [],
                borderColor: this.getColorForIndex(index),
                fill: false,
              };
            } catch (err) {
              return {
                label: `Character ${characterId}`,
                data: [],
                borderColor: this.getColorForIndex(index),
                fill: false,
              };
            }
          })
        );

        // Generate at least some dummy time labels for the empty chart
        const labels = [];
        const today = new Date();
        // Determine appropriate number of days based on the groupBy parameter
        const daysToGenerate =
          groupBy === "hour" ? 1 : groupBy === "day" ? 7 : 4; // 1 day for hourly, 7 for daily, 4 weeks for weekly
        for (let i = daysToGenerate - 1; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          labels.push(format(date, this.getDateFormat(groupBy)));
        }

        return {
          labels,
          datasets: emptyDatasets,
          title: "",
          displayType: "line" as ChartDisplayType,
        };
      }

      const kills = killsQuery.map((kill: any) => {
        logger.debug(
          `Processing kill: ID ${kill.killmail_id}, time ${kill.kill_time}, character ${kill.character_id}`
        );
        return {
          killTime: kill.kill_time,
          totalValue: kill.total_value,
          points: kill.points || 0,
          attackerCount: kill.attacker_count || 1,
          characters: [{ characterId: kill.character_id.toString() }],
        };
      }) as KillData[];

      // Group kills by time period
      logger.info(`Grouping ${kills.length} kills by ${groupBy}`);
      const groupedData = this.groupDataByTime(
        kills,
        groupBy,
        (kill: KillData) => ({
          timestamp: kill.killTime,
          value:
            displayMetric === "value"
              ? Number(kill.totalValue)
              : displayMetric === "kills"
              ? 1
              : displayMetric === "points"
              ? kill.points
              : kill.attackerCount,
        })
      );

      logger.info(`Created ${groupedData.length} time groups`);

      // Sort character IDs by activity (total value, kill count, etc.) to show the most active characters
      let characterActivity: { id: bigint; activity: number; name: string }[] =
        [];

      for (const characterId of characterIds) {
        const character = await this.prisma.character.findUnique({
          where: { eveId: characterId.toString() },
        });

        if (!character) {
          logger.warn(`Character ${characterId} not found in database`);
          continue;
        }

        // Find all alts for this character
        const alts = await this.prisma.character.findMany({
          where: { mainCharacterId: character.eveId },
        });

        // Get all character IDs (main + alts)
        const allIds = [
          BigInt(character.eveId),
          ...alts.map((alt) => BigInt(alt.eveId)),
        ];

        // Calculate activity based on displayMetric
        const characterKills = kills.filter((kill: KillData) =>
          kill.characters.some((kc) => allIds.includes(BigInt(kc.characterId)))
        );

        const activity = characterKills.reduce((total, kill) => {
          if (displayMetric === "value") return total + Number(kill.totalValue);
          if (displayMetric === "kills") return total + 1;
          if (displayMetric === "points") return total + kill.points;
          if (displayMetric === "attackers") return total + kill.attackerCount;
          return total;
        }, 0);

        // Only include characters with some activity
        if (activity > 0) {
          characterActivity.push({
            id: characterId,
            activity,
            name: character.name,
          });
        }
      }

      // Sort by activity descending and take the top 'limit' characters
      characterActivity.sort((a, b) => b.activity - a.activity);
      const topCharacterIds = characterActivity.slice(0, limit);

      logger.info(
        `Selected top ${
          topCharacterIds.length
        } most active characters for display: ${topCharacterIds
          .map((c) => c.name)
          .join(", ")}`
      );

      // If no characters have activity, return empty chart
      if (topCharacterIds.length === 0) {
        return {
          labels: [],
          datasets: [],
          title: "",
          displayType: "line" as ChartDisplayType,
        };
      }

      // Create datasets for each character - now include all alts for each main character
      logger.info(
        "Creating datasets for each main character including their alts"
      );
      const datasets = await Promise.all(
        topCharacterIds.map(async (charItem, index) => {
          const characterId = charItem.id;
          const character = await this.prisma.character.findUnique({
            where: { eveId: characterId.toString() },
          });

          if (!character) {
            logger.warn(`Character ${characterId} not found in database`);
            return {
              label: `Character ${characterId}`,
              data: [],
              borderColor: this.getColorForIndex(index),
              fill: false,
            };
          }

          logger.info(
            `Processing main character ${character.name} (${character.eveId})`
          );

          // Find all alts for this character
          const alts = await this.prisma.character.findMany({
            where: { mainCharacterId: character.eveId },
          });

          logger.info(`Found ${alts.length} alts for ${character.name}`);

          // Get all character IDs (main + alts)
          const allIds = [
            BigInt(character.eveId),
            ...alts.map((alt) => BigInt(alt.eveId)),
          ];

          // Filter kills for this character and all its alts
          const characterKills = kills.filter((kill: KillData) =>
            kill.characters.some((kc) =>
              allIds.includes(BigInt(kc.characterId))
            )
          );

          logger.info(
            `Found ${characterKills.length} kills for character ${character.name} and alts`
          );

          // Create a display name that shows activity level
          const activityText =
            displayMetric === "value"
              ? this.formatValue(charItem.activity)
              : charItem.activity.toLocaleString();

          const metricLabel =
            displayMetric === "value"
              ? "ISK"
              : displayMetric === "kills"
              ? "kills"
              : displayMetric === "points"
              ? "pts"
              : "attackers";

          const displayName = `${character.name} (${activityText} ${metricLabel})`;

          const characterData = this.groupDataByTime(
            characterKills,
            groupBy,
            (kill: KillData) => ({
              timestamp: kill.killTime,
              value:
                displayMetric === "value"
                  ? Number(kill.totalValue)
                  : displayMetric === "kills"
                  ? 1
                  : displayMetric === "points"
                  ? kill.points
                  : kill.attackerCount,
            })
          );

          logger.info(
            `Created ${characterData.length} data points for character ${character.name}`
          );

          return {
            label: displayName,
            data: characterData.map((d) => d.value),
            borderColor: this.getColorForIndex(index),
            fill: false,
          };
        })
      );

      logger.info(
        `Created ${datasets.length} datasets with labels: ${datasets
          .map((d) => d.label)
          .join(", ")}`
      );
      logger.info(
        `Chart will have ${groupedData.length} labels and ${datasets.length} datasets`
      );

      return {
        labels: groupedData.map((d) =>
          format(d.timestamp, this.getDateFormat(groupBy))
        ),
        datasets,
        title: "",
        displayType: "line" as ChartDisplayType,
      };
    } catch (error) {
      logger.error("Error generating kills chart:", error);
      // Return empty chart on error
      return {
        labels: [],
        datasets: [],
        title: "",
        displayType: "line" as ChartDisplayType,
      };
    }
  }

  // Helper function to format values with K/M/B suffixes
  private formatValue(value: number): string {
    if (value >= 1_000_000_000) {
      return (value / 1_000_000_000).toFixed(1) + "B";
    } else if (value >= 1_000_000) {
      return (value / 1_000_000).toFixed(1) + "M";
    } else if (value >= 1_000) {
      return (value / 1_000).toFixed(1) + "K";
    }
    return value.toString();
  }

  // Helper method to get a color from the color array
  private getColorForIndex(index: number): string {
    return this.colors[index % this.colors.length];
  }

  private async generateMapActivityChart(
    characterIds: bigint[],
    startDate: Date,
    groupBy: "hour" | "day" | "week"
  ): Promise<ChartData> {
    // Convert character IDs to strings for query
    const characterIdStrings = characterIds.map((id) => id.toString());

    logger.info(
      `Generating map activity chart for ${
        characterIds.length
      } characters from ${startDate.toISOString()}`
    );
    logger.info(`Character IDs: ${characterIdStrings.join(", ")}`);

    try {
      // First, get all characters including alts for the requested main characters
      const allCharacters = await this.prisma.character.findMany({
        where: {
          OR: [
            { eveId: { in: characterIdStrings } }, // Main characters
            { mainCharacterId: { in: characterIdStrings } }, // Alt characters
          ],
        },
      });

      const allCharacterIdStrings = allCharacters.map((c) => c.eveId);
      logger.info(
        `Including all characters and alts: ${allCharacters.length} characters total`
      );

      // Get map activity for each character
      logger.info("Querying mapActivity table with expanded character list...");
      const activitiesRaw = await this.prisma.mapActivity.findMany({
        where: {
          characterId: { in: allCharacterIdStrings as any },
          timestamp: { gte: startDate },
        },
        orderBy: { timestamp: "asc" },
      });

      logger.info(
        `Found ${activitiesRaw.length} map activity records in database`
      );

      if (activitiesRaw.length === 0) {
        logger.warn(
          "No map activity found for the specified characters and time period"
        );
        // Let's check if there are any activity records at all in the database
        const totalActivityCount = await this.prisma.mapActivity.count();
        logger.info(`Total map activities in database: ${totalActivityCount}`);

        // Sample a few records to understand the data structure
        if (totalActivityCount > 0) {
          const sampleRecords = await this.prisma.mapActivity.findMany({
            take: 5,
          });
          logger.info(
            `Sample map activity records: ${JSON.stringify(sampleRecords)}`
          );
        }
      }

      // Convert to ActivityData
      const activities: ActivityData[] = activitiesRaw.map((activity) => ({
        timestamp: activity.timestamp,
        signatures: activity.signatures,
        characterId: String(activity.characterId),
      }));

      // Group activities by time period
      logger.info(`Grouping ${activities.length} activities by ${groupBy}`);
      const groupedData = this.groupDataByTime(
        activities,
        groupBy,
        (activity: ActivityData) => ({
          timestamp: activity.timestamp,
          value: activity.signatures,
        })
      );

      logger.info(`Created ${groupedData.length} time groups`);

      // Create datasets for each main character
      logger.info(
        "Creating datasets for each main character including their alts"
      );
      const datasets = await Promise.all(
        characterIds.map(async (characterId) => {
          const character = await this.prisma.character.findUnique({
            where: { eveId: characterId.toString() },
          });

          if (!character) {
            logger.warn(`Character ${characterId} not found in database`);
            return {
              label: `Character ${characterId}`,
              data: [],
              borderColor: this.getRandomColor(),
              fill: false,
            };
          }

          logger.info(
            `Processing main character ${character.name} (${character.eveId})`
          );

          // Find all alts for this character
          const alts = await this.prisma.character.findMany({
            where: { mainCharacterId: character.eveId },
          });

          logger.info(`Found ${alts.length} alts for ${character.name}`);

          // Get all character IDs (main + alts)
          const allIds = [character.eveId, ...alts.map((alt) => alt.eveId)];

          // Filter activities for this character and all its alts
          const characterActivities = activities.filter(
            (activity: ActivityData) => allIds.includes(activity.characterId)
          );

          logger.info(
            `Found ${characterActivities.length} activities for character ${character.name} and alts`
          );

          const characterData = this.groupDataByTime(
            characterActivities,
            groupBy,
            (activity: ActivityData) => ({
              timestamp: activity.timestamp,
              value: activity.signatures,
            })
          );

          logger.info(
            `Created ${characterData.length} data points for character ${character.name}`
          );

          return {
            label: character.name,
            data: characterData.map((d) => d.value),
            borderColor: this.getRandomColor(),
            fill: false,
          };
        })
      );

      logger.info(
        `Created ${datasets.length} datasets with labels: ${datasets
          .map((d) => d.label)
          .join(", ")}`
      );
      logger.info(
        `Chart will have ${groupedData.length} labels and ${datasets.length} datasets`
      );

      return {
        labels: groupedData.map((d) =>
          format(d.timestamp, this.getDateFormat(groupBy))
        ),
        datasets,
        title: "",
        displayType: "line" as ChartDisplayType,
      };
    } catch (error) {
      logger.error("Error generating map activity chart:", error);
      // Return empty chart on error
      return {
        labels: [],
        datasets: [],
        title: "",
        displayType: "line" as ChartDisplayType,
      };
    }
  }

  private groupDataByTime<T>(
    data: T[],
    groupBy: "hour" | "day" | "week",
    getTimestampAndValue: (item: T) => { timestamp: Date; value: number }
  ): { timestamp: Date; value: number }[] {
    const grouped = new Map<string, { timestamp: Date; value: number }>();

    // If no data, return an empty array
    if (data.length === 0) {
      return [];
    }

    // Create a dictionary for quick lookup when grouping data
    for (const item of data) {
      const { timestamp, value } = getTimestampAndValue(item);
      const key = format(timestamp, this.getGroupByFormat(groupBy));

      if (!grouped.has(key)) {
        grouped.set(key, { timestamp, value: 0 });
      }

      const current = grouped.get(key)!;
      current.value += value;
    }

    // Sort by timestamp
    return Array.from(grouped.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  private getGroupByFormat(groupBy: "hour" | "day" | "week"): string {
    switch (groupBy) {
      case "hour":
        return "yyyy-MM-dd HH:00";
      case "day":
        return "yyyy-MM-dd";
      case "week":
        return "yyyy-'W'ww";
      default:
        throw new Error(`Invalid groupBy: ${groupBy}`);
    }
  }

  private getDateFormat(groupBy: "hour" | "day" | "week"): string {
    switch (groupBy) {
      case "hour":
        return "MMM d, HH:mm";
      case "day":
        return "MMM d";
      case "week":
        return "'Week' w";
      default:
        throw new Error(`Invalid groupBy: ${groupBy}`);
    }
  }

  private getRandomColor(): string {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  /**
   * Generates a grouped kills chart by character group for kills data
   */
  async generateGroupedKillsChart(config: {
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>;
    startDate: Date;
    endDate: Date;
    displayType: string;
  }): Promise<ChartData> {
    const {
      characterGroups,
      startDate,
      endDate,
      displayType: _displayType,
    } = config;

    logger.info(
      `Generating grouped kills chart from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Enhanced group data with main character information
    const enhancedGroups = await Promise.all(
      characterGroups.map(async (group) => {
        // Try to find main character in the group
        let mainCharacter = null;

        // First, check if the group has a mainCharacterId set
        if (group.mainCharacterId) {
          mainCharacter = group.characters.find(
            (c) => c.eveId === group.mainCharacterId
          );
        }

        // If no main was found by ID, try to find characters that are designated as mains
        if (!mainCharacter) {
          for (const character of group.characters) {
            // Check if this character has alts (other characters pointing to it as main)
            const hasAlts = await this.prisma.character.count({
              where: {
                mainCharacterId: character.eveId,
              },
            });

            if (hasAlts > 0) {
              // This is a main character
              mainCharacter = character;
              break;
            }
          }
        }

        // If still no main was found, just use the first character
        if (!mainCharacter && group.characters.length > 0) {
          mainCharacter = group.characters[0];
        }

        // Use just the character name as the display name
        const displayName = mainCharacter
          ? mainCharacter.name
          : group.characters.length > 0
          ? group.characters[0].name
          : group.name;

        return {
          ...group,
          mainCharacter,
          displayName,
        };
      })
    );

    // Get displayable groups with at least one character
    const displayGroups = enhancedGroups.filter(
      (group) => group.characters.length > 0
    );

    // Print the detailed group information for debugging
    if (displayGroups.length > 0) {
      logger.info(
        `Found ${displayGroups.length} valid character groups with at least one character`
      );
      displayGroups.forEach((group, index) => {
        logger.info(
          `Group ${index + 1}: "${group.displayName}" (Main: ${
            group.mainCharacter?.name
          }) - ${group.characters.length} characters`
        );
      });
    } else {
      logger.warn("No valid character groups found with characters");
    }

    // First, collect all groups with their kill data and filter out those without kills
    const groupsWithData = [];
    const groupsWithoutKills = [];

    try {
      // For each group, get the kill statistics using enhanced stats
      for (const group of displayGroups) {
        // Get all character IDs in this group
        const characterIds = group.characters.map((c) => BigInt(c.eveId));

        if (characterIds.length === 0) {
          logger.info(`No characters in group ${group.displayName}, skipping`);
          continue;
        }

        // Get all kills for these characters
        const kills = await this.prisma.killFact.findMany({
          where: {
            character_id: {
              in: characterIds,
            },
            kill_time: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            attackers: {
              select: {
                character_id: true,
                corporation_id: true,
                alliance_id: true,
                ship_type_id: true,
                weapon_type_id: true,
                damage_done: true,
                final_blow: true,
              },
            },
          },
        });

        if (kills.length === 0) {
          logger.info(
            `No kills found for group ${group.displayName}, skipping`
          );
          groupsWithoutKills.push(group.displayName);
          continue;
        }

        // Calculate solo kills (where all attackers are from this group)
        let soloKills = 0;
        for (const kill of kills) {
          // Skip kills with no attackers
          if (!kill.attackers || kill.attackers.length === 0) continue;

          // Get all player attackers (those with character IDs)
          const playerAttackers = kill.attackers.filter((a) => a.character_id);
          if (playerAttackers.length === 0) continue;

          // Check if all attackers are from this group
          const allFromGroup = playerAttackers.every((attacker) => {
            if (!attacker.character_id) return false;
            return characterIds.includes(BigInt(attacker.character_id));
          });

          if (allFromGroup) {
            soloKills++;
            logger.info(
              `Found solo kill for group ${group.displayName}: Kill ID ${kill.killmail_id}`
            );
          }
        }

        // Only add to our results if there are actually kills
        if (kills.length > 0) {
          // Always use the main character's name as the display name
          const displayName = group.mainCharacter
            ? group.mainCharacter.name
            : group.displayName;

          groupsWithData.push({
            group: {
              ...group,
              displayName,
            },
            totalKills: kills.length,
            soloKills: soloKills,
          });

          logger.info(
            `Group ${displayName} (Main: ${group.mainCharacter?.name}): ${kills.length} total kills, ${soloKills} solo kills`
          );
        }
      }

      // Log groups that were filtered out
      if (groupsWithoutKills.length > 0) {
        logger.info(
          `Filtered out ${
            groupsWithoutKills.length
          } groups with no kills: ${groupsWithoutKills.join(", ")}`
        );
      }

      // If no groups have kills, return empty chart
      if (groupsWithData.length === 0) {
        logger.info("No groups with kills found, returning empty chart");
        return {
          labels: [],
          datasets: [],
          displayType: "horizontalBar" as ChartDisplayType,
          summary: "No kills found in the specified time period",
        };
      }

      // Sort groups by total kills in descending order
      groupsWithData.sort((a, b) => b.totalKills - a.totalKills);

      // Create chart data structure from our filtered and sorted groups
      const groupLabels = groupsWithData.map((item) => item.group.displayName);
      const totalKillsData = groupsWithData.map((item) => item.totalKills);
      const soloKillsData = groupsWithData.map((item) => item.soloKills);

      // Calculate overall statistics
      const overallTotalKills = totalKillsData.reduce((a, b) => a + b, 0);
      const overallSoloKills = soloKillsData.reduce((a, b) => a + b, 0);

      return {
        labels: groupLabels,
        datasets: [
          {
            label: "Total Kills",
            data: totalKillsData,
            backgroundColor: "#3366CC",
          },
          {
            label: "Solo Kills",
            data: soloKillsData,
            backgroundColor: "#DC3912",
          },
        ],
        displayType: "horizontalBar" as ChartDisplayType,
        summary: `Total kills: ${overallTotalKills.toLocaleString()}\nSolo kills: ${overallSoloKills.toLocaleString()} (${
          overallTotalKills > 0
            ? Math.round((overallSoloKills / overallTotalKills) * 100)
            : 0
        }%)`,
      };
    } catch (error) {
      logger.error("Error generating kills chart:", error);
      throw error;
    }
  }



  /**
   * Generates a grouped map activity chart by character group
   */
  async generateGroupedMapActivityChart(config: {
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>;
    startDate: Date;
    endDate: Date;
    displayType: string;
  }): Promise<ChartData> {
    const { characterGroups, startDate, endDate, displayType } = config;

    logger.info(
      `Generating grouped map activity chart from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // If no character groups provided, get all characters
    if (!characterGroups || characterGroups.length === 0) {
      logger.info(
        "No character groups provided, creating default group with all characters"
      );
      try {
        const allCharacters = await this.prisma.character.findMany({
          select: {
            eveId: true,
            name: true,
          },
        });

        if (allCharacters.length === 0) {
          logger.warn("No characters found in database");
          return {
            labels: ["No Characters"],
            datasets: [
              {
                label: "Signatures",
                data: [0],
                backgroundColor: "#3366CC",
              },
              {
                label: "Cosmic Anomalies",
                data: [0],
                backgroundColor: "#DC3912",
              },
              {
                label: "Wormholes",
                data: [0],
                backgroundColor: "#FF9900",
              },
            ],
            displayType: "horizontalBar" as ChartDisplayType,
          };
        }

        // Continue with default group
        return this.generateGroupedMapActivityChart({
          characterGroups: [
            {
              groupId: "default",
              name: "All Characters",
              characters: allCharacters,
            },
          ],
          startDate,
          endDate,
          displayType,
        });
      } catch (error) {
        logger.error("Error creating default character group:", error);
        throw new Error(
          "No character groups available and could not create default group"
        );
      }
    }

    // Enhanced group data with main character information
    const enhancedGroups = await Promise.all(
      characterGroups.map(async (group) => {
        // Try to find main character in the group
        let mainCharacter = null;

        // First, try to find characters that are designated as mains
        for (const character of group.characters) {
          // Check if this character has alts (other characters pointing to it as main)
          const hasAlts = await this.prisma.character.count({
            where: {
              mainCharacterId: character.eveId,
            },
          });

          if (hasAlts > 0) {
            // This is a main character
            mainCharacter = character;
            break;
          }
        }

        // If no main was found, just use the first character
        if (!mainCharacter && group.characters.length > 0) {
          mainCharacter = group.characters[0];
        }

        // Use just the character name as the display name
        const displayName = mainCharacter
          ? mainCharacter.name
          : group.characters.length > 0
          ? group.characters[0].name
          : group.name;

        return {
          ...group,
          mainCharacter,
          displayName,
        };
      })
    );

    // Get displayable groups with at least one character
    const displayGroups = enhancedGroups.filter(
      (group) => group.characters.length > 0
    );

    // Print the detailed group information for debugging
    if (displayGroups.length > 0) {
      logger.info(
        `Found ${displayGroups.length} valid character groups with at least one character`
      );
      displayGroups.forEach((group, index) => {
        logger.info(
          `Group ${index + 1}: "${group.displayName}" - ${
            group.characters.length
          } characters`
        );
      });
    } else {
      logger.warn("No valid character groups found with characters");
    }

    // Collect all groups with their activity data first, so we can filter out empty ones
    const groupsWithData = [];

    try {
      // For each group, get the map activity statistics
      for (const group of displayGroups) {
        // Get all character IDs in this group
        const characterIds = group.characters.map((c) => BigInt(c.eveId));

        if (characterIds.length === 0) {
          logger.info(`No characters in group ${group.displayName}, skipping`);
          continue;
        }

        // Get all map activities for these characters
        const activities = await this.prisma.mapActivity.findMany({
          where: {
            characterId: {
              in: characterIds,
            },
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            signatures: true,
            connections: true,
            passages: true,
          },
        });

        if (activities.length === 0) {
          logger.info(`No map activities found for group ${group.displayName}`);
          continue;
        }

        // Sum up activity values
        const signatures = activities.reduce(
          (sum, act) => sum + act.signatures,
          0
        );
        const connections = activities.reduce(
          (sum, act) => sum + act.connections,
          0
        );
        const passages = activities.reduce((sum, act) => sum + act.passages, 0);

        // Only add to our results if there is actually activity
        const totalActivity = signatures + connections + passages;
        if (totalActivity > 0) {
          groupsWithData.push({
            group,
            signatures,
            connections,
            passages,
            totalActivity,
          });

          logger.info(
            `Group ${group.displayName}: ${signatures} signatures, ${connections} connections, ${passages} passages`
          );
        }
      }

      // Sort groups by total activity in descending order
      groupsWithData.sort((a, b) => b.totalActivity - a.totalActivity);

      // Create chart data structure from our filtered and sorted groups
      const groupLabels = groupsWithData.map((item) => item.group.displayName);
      const signaturesData = groupsWithData.map((item) => item.signatures);
      const connectionsData = groupsWithData.map((item) => item.connections);
      const passagesData = groupsWithData.map((item) => item.passages);

      // Return the final chart data
      return {
        labels: groupLabels,
        datasets: [
          {
            label: "Signatures",
            data: signaturesData,
            backgroundColor: "#3366CC",
          },
          {
            label: "Cosmic Anomalies",
            data: connectionsData,
            backgroundColor: "#DC3912",
          },
          {
            label: "Wormholes",
            data: passagesData,
            backgroundColor: "#FF9900",
          },
        ],
        displayType: "horizontalBar" as ChartDisplayType,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Error generating grouped map activity chart:", error);
      throw new Error(
        `Failed to generate grouped map activity chart: ${errorMessage}`
      );
    }
  }

  /**
   * Gets all tracked characters
   */
  async getTrackedCharacters(): Promise<
    Array<{ eveId: string; name: string }>
  > {
    try {
      // Find only main characters (no mainCharacterId means it's a main character)
      const characters = await this.prisma.character.findMany({
        where: {
          mainCharacterId: null,
        },
        select: {
          eveId: true,
          name: true,
        },
      });

      logger.info(`Found ${characters.length} tracked characters`);
      return characters;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Error fetching tracked characters:", errorMessage);
      return [];
    }
  }

  /**
   * Gets all character groups with their members
   */
  async getCharacterGroups(): Promise<
    Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>
  > {
    try {
      // First, count the total number of character groups
      const totalGroups = await this.prisma.characterGroup.count();

      logger.info(`Found ${totalGroups} character groups in database`);

      // If we have a suspiciously large number of groups, use a different approach
      if (totalGroups > 1000) {
        logger.warn(
          `Unusually high number of character groups (${totalGroups}). Using optimized approach.`
        );

        // Get only groups that have at least one character (using a JOIN)
        const groupsWithCharacters = await this.prisma.characterGroup.findMany({
          where: {
            characters: {
              some: {}, // Groups that have at least one character
            },
          },
          select: {
            id: true,
            slug: true,
            _count: {
              select: { characters: true },
            },
          },
        });

        logger.info(
          `Found ${groupsWithCharacters.length} groups with at least one character`
        );

        // Process these groups in batches to avoid memory issues
        const result = [];
        const batchSize = 50;

        for (let i = 0; i < groupsWithCharacters.length; i += batchSize) {
          const batch = groupsWithCharacters.slice(i, i + batchSize);
          logger.info(
            `Processing batch ${i / batchSize + 1} of ${Math.ceil(
              groupsWithCharacters.length / batchSize
            )}`
          );

          for (const group of batch) {
            // For each group, get its characters
            const characters = await this.prisma.character.findMany({
              where: {
                characterGroupId: group.id,
              },
              select: {
                eveId: true,
                name: true,
              },
            });

            if (characters.length > 0) {
              result.push({
                groupId: group.id,
                name: group.slug || `Group ${group.id.substring(0, 8)}`,
                characters,
              });
            }
          }
        }

        logger.info(
          `Successfully processed ${result.length} valid character groups`
        );
        return result;
      }

      // Standard approach for a reasonable number of groups
      const groups = await this.prisma.characterGroup.findMany({
        select: {
          id: true,
          slug: true,
          mainCharacterId: true,
          characters: {
            select: {
              eveId: true,
              name: true,
            },
          },
        },
      });

      logger.info(`Found ${groups.length} character groups`);

      // Filter out groups with no characters
      const validGroups = groups.filter((group) => group.characters.length > 0);
      logger.info(`${validGroups.length} groups have at least one character`);

      return validGroups.map((group) => ({
        groupId: group.id,
        name: group.slug || `Group ${group.id.substring(0, 8)}`,
        characters: group.characters.map((char) => ({
          eveId: char.eveId,
          name: char.name,
        })),
        mainCharacterId: group.mainCharacterId || undefined,
      }));
    } catch (error: unknown) {
      logger.error("Error fetching character groups:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // If we encounter an error, try a different approach to get at least some valid groups
      try {
        logger.info(
          "Attempting alternative approach to fetch character groups"
        );

        // Get characters that belong to a group
        const characters = await this.prisma.character.findMany({
          where: {
            characterGroupId: { not: null },
          },
          select: {
            eveId: true,
            name: true,
            characterGroupId: true,
          },
        });

        // Manually group them
        const groupMap = new Map<
          string,
          {
            characters: Array<{ eveId: string; name: string }>;
            slug?: string;
            mainCharacterId?: string;
          }
        >();

        for (const char of characters) {
          if (!char.characterGroupId) continue;

          if (!groupMap.has(char.characterGroupId)) {
            groupMap.set(char.characterGroupId, { characters: [] });
          }

          groupMap.get(char.characterGroupId)!.characters.push({
            eveId: char.eveId,
            name: char.name,
          });
        }

        // Convert to the expected format
        const result = Array.from(groupMap.entries()).map(
          ([groupId, data]) => ({
            groupId,
            name: data.slug || `Group ${groupId.substring(0, 8)}`,
            characters: data.characters,
            mainCharacterId: data.mainCharacterId, // Include mainCharacterId
          })
        );

        logger.info(
          `Alternative approach found ${result.length} character groups`
        );
        return result;
      } catch (fallbackError) {
        logger.error(
          "Error with alternative character group approach:",
          fallbackError
        );

        // Last resort: return an empty array instead of a default group
        logger.info("No valid character groups found, returning empty array");
        return [];
      }
    }
  }
}
