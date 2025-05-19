import { Prisma } from "@prisma/client";
import { BaseRepository } from "./BaseRepository";
import { buildWhereFilter } from "../../utils/query-helper";
import { logger } from "../../lib/logger";

/**
 * Repository for accessing kill-related data
 */
export class KillRepository extends BaseRepository {
  constructor() {
    super("killFact");
  }

  /**
   * Get kills for a specific character within a date range
   */
  async getKillsForCharacter(
    characterId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    return this.executeQuery(() =>
      this.prisma.killFact.findMany({
        where: buildWhereFilter({
          character_id: BigInt(characterId),
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        }),
        select: {
          killmail_id: true,
          character_id: true,
          kill_time: true,
          total_value: true,
          solo: true,
        },
        orderBy: {
          kill_time: "asc",
        },
      })
    );
  }

  /**
   * Get kills for a list of characters within a date range
   */
  async getKillsForCharacters(
    characterIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    // Convert strings to BigInts for query
    const bigIntIds = characterIds.map((id) => BigInt(id));

    return this.executeQuery(() =>
      this.prisma.killFact.findMany({
        where: buildWhereFilter({
          character_id: {
            in: bigIntIds,
          },
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        }),
        select: {
          killmail_id: true,
          character_id: true,
          kill_time: true,
          solo: true,
          attackers: {
            select: {
              character_id: true,
            },
          },
        },
        orderBy: {
          kill_time: "asc",
        },
      })
    );
  }

  /**
   * Get kills for a character group within a date range
   */
  async getKillsForGroup(
    groupId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    return this.executeQuery(async () => {
      // First, get all characters in the group
      const group = await this.prisma.characterGroup.findUnique({
        where: { id: groupId },
        include: { characters: true },
      });

      if (!group) {
        return [];
      }

      // Get character IDs
      const characterIds = group.characters.map((c: any) => c.eveId);

      // Get kills for all characters
      return this.getKillsForCharacters(characterIds, startDate, endDate);
    });
  }

  /**
   * Get kill statistics for a character
   */
  async getKillStats(
    characterId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalKills: number;
    soloKills: number;
    totalValue: bigint;
    averageValue: bigint;
  }> {
    return this.executeQuery(async () => {
      const kills = await this.getKillsForCharacter(
        characterId,
        startDate,
        endDate
      );

      if (kills.length === 0) {
        return {
          totalKills: 0,
          soloKills: 0,
          totalValue: BigInt(0),
          averageValue: BigInt(0),
        };
      }

      // Calculate statistics
      const totalKills = kills.length;
      const soloKills = kills.filter((k: any) => k.solo === true).length;
      const totalValue = kills.reduce(
        (sum: bigint, kill: any) => sum + kill.total_value,
        BigInt(0)
      );
      const averageValue =
        totalKills > 0 ? totalValue / BigInt(totalKills) : BigInt(0);

      return {
        totalKills,
        soloKills,
        totalValue,
        averageValue,
      };
    });
  }

  /**
   * Get kill statistics for a character group
   */
  async getGroupKillStats(
    groupId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalKills: number;
    soloKills: number;
    totalValue: bigint;
    averageValue: bigint;
  }> {
    return this.executeQuery(async () => {
      const kills = await this.getKillsForGroup(groupId, startDate, endDate);

      if (kills.length === 0) {
        return {
          totalKills: 0,
          soloKills: 0,
          totalValue: BigInt(0),
          averageValue: BigInt(0),
        };
      }

      // Calculate statistics
      const totalKills = kills.length;
      const soloKills = kills.filter((k: any) => k.solo === true).length;
      const totalValue = kills.reduce(
        (sum: bigint, kill: any) => sum + kill.total_value,
        BigInt(0)
      );
      const averageValue =
        totalKills > 0 ? totalValue / BigInt(totalKills) : BigInt(0);

      return {
        totalKills,
        soloKills,
        totalValue,
        averageValue,
      };
    });
  }

  /**
   * Get kill statistics for a character group with enhanced solo kill detection
   *
   * This considers a kill "solo" if:
   * 1. It's marked as solo in the database (one attacker), OR
   * 2. All attackers are from the same character group (group solo)
   */
  async getGroupKillStatsEnhanced(
    groupId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalKills: number;
    soloKills: number;
    groupSoloKills: number; // Kills where all attackers are from this group
    totalValue: bigint;
    averageValue: bigint;
  }> {
    return this.executeQuery(async () => {
      // Get kills from normal query first
      const basicStats = await this.getGroupKillStats(
        groupId,
        startDate,
        endDate
      );

      // Get character IDs in this group
      const group = await this.prisma.characterGroup.findUnique({
        where: { id: groupId },
        include: { characters: true },
      });

      if (!group || group.characters.length === 0) {
        return {
          ...basicStats,
          groupSoloKills: 0,
        };
      }

      // Convert character IDs to strings for comparison
      const groupCharacterIds = group.characters.map((c: any) => c.eveId);

      // Get all kills for this group in this time period
      const kills = await this.getKillsForGroup(groupId, startDate, endDate);

      if (kills.length === 0) {
        return {
          ...basicStats,
          groupSoloKills: 0,
        };
      }

      // Create a list of killmail IDs to query
      const killmailIds = kills.map((k: any) => k.killmail_id);

      // Find group solo kills where all attackers are from the same group
      let groupSoloKills = 0;

      // Process kills in smaller batches to avoid memory issues
      const batchSize = 100;
      for (let i = 0; i < killmailIds.length; i += batchSize) {
        const batchIds = killmailIds.slice(i, i + batchSize);

        // Get all the kills with their attackers
        const killsWithAttackers = await this.prisma.killFact.findMany({
          where: {
            killmail_id: {
              in: batchIds,
            },
          },
          include: {
            attackers: true,
          },
        });

        // Check each kill to see if all attackers are from this group
        for (const kill of killsWithAttackers) {
          // Skip kills with no attackers in the attackers table
          if (kill.attackers.length === 0) {
            continue;
          }

          // Count attackers from our group vs total
          const playerAttackers = kill.attackers.filter(
            (a: any) => a.character_id
          );
          const attackerCharIds = playerAttackers
            .map((a: any) => (a.character_id ? String(a.character_id) : null))
            .filter(Boolean) as string[];

          // Check if all attacker character IDs exist in this group
          const allFromGroup = attackerCharIds.every((charId) =>
            groupCharacterIds.includes(charId)
          );

          // If it's a group solo kill, count it
          if (allFromGroup && attackerCharIds.length > 0) {
            groupSoloKills++;
          }
        }
      }

      // Return combined stats
      return {
        ...basicStats,
        groupSoloKills,
      };
    });
  }

  /**
   * Get kills grouped by time period for chart data
   */
  async getKillsGroupedByTime(
    characterIds: string[],
    startDate: Date,
    endDate: Date,
    groupBy: "hour" | "day" | "week" = "day"
  ): Promise<Array<{ timestamp: Date; kills: number; value: bigint }>> {
    return this.executeQuery(async () => {
      // Get all kills for the characters
      const kills = await this.getKillsForCharacters(
        characterIds,
        startDate,
        endDate
      );

      // Group by time period
      const timeMap = new Map<
        string,
        { timestamp: Date; kills: number; value: bigint }
      >();

      // Format string for grouping
      const getTimeKey = (date: Date): string => {
        switch (groupBy) {
          case "hour":
            return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
          case "week":
            const d = new Date(date);
            d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          case "day":
          default:
            return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        }
      };

      // Group the kills
      for (const kill of kills) {
        const timeKey = getTimeKey(kill.kill_time);

        if (!timeMap.has(timeKey)) {
          timeMap.set(timeKey, {
            timestamp: new Date(kill.kill_time),
            kills: 0,
            value: BigInt(0),
          });
        }

        const group = timeMap.get(timeKey)!;
        group.kills += 1;
        group.value += kill.total_value;
      }

      // Convert to array and sort by timestamp
      return Array.from(timeMap.values()).sort(
        (
          a: { timestamp: Date; kills: number; value: bigint },
          b: { timestamp: Date; kills: number; value: bigint }
        ) => a.timestamp.getTime() - b.timestamp.getTime()
      );
    });
  }

  /**
   * Get the top ship types destroyed within a date range
   */
  async getTopShipTypesDestroyed(
    characterIds: string[],
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{ shipTypeId: string; count: number }>> {
    return this.executeQuery(async () => {
      // Convert strings to BigInts for query
      const bigIntIds = characterIds.map((id) => BigInt(id));

      // Get all kills for the characters in the specified date range
      const kills = await this.prisma.killFact.findMany({
        where: buildWhereFilter({
          character_id: {
            in: bigIntIds,
          },
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        }),
        select: {
          killmail_id: true,
          ship_type_id: true,
        },
      });

      // Group kills by ship type
      const shipTypeCounts = new Map<string, { id: string; count: number }>();

      for (const kill of kills) {
        const shipTypeId = kill.ship_type_id.toString();
        if (shipTypeCounts.has(shipTypeId)) {
          shipTypeCounts.get(shipTypeId)!.count++;
        } else {
          shipTypeCounts.set(shipTypeId, {
            id: shipTypeId,
            count: 1,
          });
        }
      }

      // Convert to array and sort by count
      const result = Array.from(shipTypeCounts.values())
        .map((item) => ({
          shipTypeId: item.id,
          count: item.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return result;
    });
  }

  /**
   * Get ship types destroyed over time within a date range
   */
  async getShipTypesOverTime(
    characterIds: string[],
    startDate: Date,
    endDate: Date,
    limit: number = 5
  ): Promise<Record<string, Record<string, { count: number }>>> {
    return this.executeQuery(async () => {
      // Convert strings to BigInts for query
      const bigIntIds = characterIds.map((id) => BigInt(id));

      // Get all kills for the characters in the specified date range
      const kills = await this.prisma.killFact.findMany({
        where: {
          character_id: {
            in: bigIntIds,
          },
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          killmail_id: true,
          kill_time: true,
          ship_type_id: true,
        },
      });

      // First, find the top ship types overall
      const shipTypeCounts = new Map<string, { count: number }>();

      for (const kill of kills) {
        const shipTypeId = kill.ship_type_id.toString();
        if (shipTypeCounts.has(shipTypeId)) {
          shipTypeCounts.get(shipTypeId)!.count++;
        } else {
          shipTypeCounts.set(shipTypeId, { count: 1 });
        }
      }

      // Get the top ship types
      const topShipTypes = Array.from(shipTypeCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit)
        .map(([id]) => id);

      // Group kills by date and ship type
      const resultByDate: Record<
        string,
        Record<string, { count: number }>
      > = {};

      // Function to get the date key in YYYY-MM-DD format
      const getDateKey = (date: Date): string => {
        return date.toISOString().split("T")[0];
      };

      // Initialize all dates with zero counts for all ship types
      const days = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      for (let i = 0; i <= days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = getDateKey(date);

        resultByDate[dateKey] = {};

        for (const shipTypeId of topShipTypes) {
          resultByDate[dateKey][shipTypeId] = { count: 0 };
        }
      }

      // Fill in the actual counts
      for (const kill of kills) {
        const shipTypeId = kill.ship_type_id.toString();

        // Only include top ship types
        if (topShipTypes.includes(shipTypeId)) {
          const dateKey = getDateKey(kill.kill_time);

          if (!resultByDate[dateKey]) {
            resultByDate[dateKey] = {};
          }

          if (!resultByDate[dateKey][shipTypeId]) {
            resultByDate[dateKey][shipTypeId] = {
              count: 0,
            };
          }

          resultByDate[dateKey][shipTypeId].count++;
        }
      }

      return resultByDate;
    });
  }

  /**
   * Get kills with attacker count for distribution analysis
   */
  async getKillsWithAttackerCount(
    characterIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ killmailId: string; attackerCount: number }>> {
    return this.executeQuery(async () => {
      // Convert strings to BigInts for query
      const bigIntIds = characterIds.map((id) => BigInt(id));

      // Get all kills for the characters in the specified date range, including attackers
      const kills = await this.prisma.killFact.findMany({
        where: {
          character_id: {
            in: bigIntIds,
          },
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          killmail_id: true,
          attackers: {
            select: {
              id: true, // just need to count
            },
          },
        },
      });

      // Transform the data
      return kills.map((kill: any) => ({
        killmailId: kill.killmail_id.toString(),
        attackerCount: kill.attackers.length,
      }));
    });
  }

  /**
   * Get top enemy corporations based on kill count
   */
  async getTopEnemyCorporations(
    characterIds: string[],
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{ corpId: string; corpName: string; killCount: number }>> {
    return this.executeQuery(async () => {
      // Convert strings to BigInts for query
      const bigIntIds = characterIds.map((id) => BigInt(id));

      // Get all kills for the characters in the specified date range, including victims
      const kills = await this.prisma.killFact.findMany({
        where: buildWhereFilter({
          character_id: {
            in: bigIntIds,
          },
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        }),
        select: {
          killmail_id: true,
          victims: {
            select: {
              corporation_id: true,
              // If you have a corporation name field in KillVictim, select it here
            },
          },
        },
      });

      // Group kills by victim corporation
      const corpKillCounts = new Map<string, { id: string; count: number }>();

      for (const kill of kills) {
        for (const victim of kill.victims) {
          const corpId = victim.corporation_id
            ? victim.corporation_id.toString()
            : "unknown";
          if (corpKillCounts.has(corpId)) {
            corpKillCounts.get(corpId)!.count++;
          } else {
            corpKillCounts.set(corpId, {
              id: corpId,
              count: 1,
            });
          }
        }
      }

      // Convert to array and sort by kill count
      const result = Array.from(corpKillCounts.values())
        .map((item) => ({
          corpId: item.id,
          corpName: item.id, // Placeholder, as we don't have corp name in KillVictim
          killCount: item.count,
        }))
        .sort((a, b) => b.killCount - a.killCount)
        .slice(0, limit);

      return result;
    });
  }

  /**
   * Get the total number of kills by corporation
   */
  async getTotalEnemyCorporationKills(
    characterIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const bigIntIds = characterIds.map((id) => BigInt(id));

    return this.executeQuery(async () => {
      const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "KillVictim"."corp_id") as count
        FROM "KillVictim"
        JOIN "KillFact" ON "KillFact"."killmail_id" = "KillVictim"."killmail_id"
        WHERE "KillFact"."character_id" IN (${Prisma.join(bigIntIds)})
        AND "KillFact"."kill_time" BETWEEN ${startDate} AND ${endDate}
      `;

      // Ensure we return a number
      return Number(result[0]?.count || 0);
    });
  }

  /**
   * Get kill activity grouped by hour and day of week for heatmap
   */
  async getKillActivityByTimeOfDay(
    characterIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ dayOfWeek: number; hourOfDay: number; kills: number }>> {
    return this.executeQuery(async () => {
      // Convert strings to BigInts for query
      const bigIntIds = characterIds.map((id) => BigInt(id));

      // Get all kills for the characters in the specified date range
      const kills = await this.prisma.killFact.findMany({
        where: {
          character_id: {
            in: bigIntIds,
          },
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          killmail_id: true,
          kill_time: true,
        },
      });

      // Group kills by day of week and hour of day
      const activityMap = new Map<string, number>();

      // Initialize all hour and day combinations to 0
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          activityMap.set(`${day}-${hour}`, 0);
        }
      }

      // Count kills for each day/hour combination
      for (const kill of kills) {
        const killDate = new Date(kill.kill_time);
        const dayOfWeek = killDate.getUTCDay(); // 0-6, where 0 is Sunday
        const hourOfDay = killDate.getUTCHours(); // 0-23
        const key = `${dayOfWeek}-${hourOfDay}`;

        activityMap.set(key, (activityMap.get(key) || 0) + 1);
      }

      // Convert map to array of objects
      const result: Array<{
        dayOfWeek: number;
        hourOfDay: number;
        kills: number;
      }> = [];

      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const key = `${day}-${hour}`;
          result.push({
            dayOfWeek: day,
            hourOfDay: hour,
            kills: activityMap.get(key) || 0,
          });
        }
      }

      return result;
    });
  }

  /**
   * Get distribution data for a character
   */
  async getDistributionData(
    characterIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ killmailId: string; attackerCount: number }>> {
    return this.executeQuery(async () => {
      // Convert strings to BigInts for query
      const bigIntIds = characterIds.map((id) => BigInt(id));

      // Get all kills for the characters in the specified date range
      const kills = await this.prisma.killFact.findMany({
        where: {
          character_id: {
            in: bigIntIds,
          },
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          killmail_id: true,
          solo: true,
        },
      });

      // Map to expected format
      return kills.map((kill) => ({
        killmailId: kill.killmail_id.toString(),
        attackerCount: kill.solo ? 1 : 2, // If not solo, assume at least 2 attackers
      }));
    });
  }

  /**
   * Get the top ship types used by characters within a date range
   */
  async getTopShipTypesUsed(
    characterIds: string[],
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{ shipTypeId: string; count: number }>> {
    return this.executeQuery(async () => {
      // Convert strings to BigInts for query
      const bigIntIds = characterIds.map((id) => BigInt(id));

      // Get all kills where these characters were attackers
      // First, get kills within the time range
      const kills = await this.prisma.killFact.findMany({
        where: buildWhereFilter({
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        }),
        select: {
          killmail_id: true,
          attackers: {
            where: {
              character_id: {
                in: bigIntIds,
              },
            },
            select: {
              ship_type_id: true,
            },
          },
        },
      });

      // Extract all attackers and their ship types
      const shipTypeCounts = new Map<string, { id: string; count: number }>();

      for (const kill of kills) {
        for (const attacker of kill.attackers) {
          if (attacker.ship_type_id === null) continue;

          const shipTypeId = attacker.ship_type_id.toString();
          if (shipTypeCounts.has(shipTypeId)) {
            shipTypeCounts.get(shipTypeId)!.count++;
          } else {
            shipTypeCounts.set(shipTypeId, {
              id: shipTypeId,
              count: 1,
            });
          }
        }
      }

      // Convert to array and sort by count
      const result = Array.from(shipTypeCounts.values())
        .map((item) => ({
          shipTypeId: item.id,
          count: item.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return result;
    });
  }

  /**
   * Get all kills where a character participated (either as the main killer or as an attacker)
   * This ensures we don't miss kills where the character participated but wasn't the main character
   */
  async getAllKillsForCharacters(
    characterIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    try {
      // Convert strings to BigInts for query
      const bigIntIds = characterIds.map((id) => BigInt(id));

      // First get kills where the character is the main killer
      const directKills = await this.prisma.killFact.findMany({
        where: buildWhereFilter({
          character_id: {
            in: bigIntIds,
          },
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        }),
        select: {
          killmail_id: true,
          character_id: true,
          kill_time: true,
          solo: true,
          attackers: {
            select: {
              character_id: true,
            },
          },
        },
        orderBy: {
          kill_time: "asc",
        },
      });

      // Then find kills via the KillFact relation to find where they're in the attackers list
      const killsAsAttacker = await this.prisma.killFact.findMany({
        where: {
          attackers: {
            some: {
              character_id: {
                in: bigIntIds,
              },
            },
          },
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          killmail_id: true,
          character_id: true,
          kill_time: true,
          solo: true,
          attackers: {
            select: {
              character_id: true,
            },
          },
        },
        orderBy: {
          kill_time: "asc",
        },
      });

      // Combine, making sure to remove duplicates by killmail_id
      const allKills = [...directKills];
      const seen = new Set(directKills.map((k) => k.killmail_id.toString()));

      for (const kill of killsAsAttacker) {
        if (!seen.has(kill.killmail_id.toString())) {
          allKills.push(kill);
          seen.add(kill.killmail_id.toString());
        }
      }

      // Sort by time
      return allKills.sort(
        (a, b) =>
          (a.kill_time as Date).getTime() - (b.kill_time as Date).getTime()
      );
    } catch (error) {
      logger.error(
        `Error in getAllKillsForCharacters: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }
}
