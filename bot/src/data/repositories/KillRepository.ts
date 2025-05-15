import { BaseRepository } from "./BaseRepository";
import { Character } from "@prisma/client";
import { CharacterRepository } from "./CharacterRepository";

/**
 * Repository for accessing kill-related data
 */
export class KillRepository extends BaseRepository<any> {
  private characterRepository: CharacterRepository;

  constructor() {
    super("killFact");
    this.characterRepository = new CharacterRepository();

    // Set a longer cache TTL for kill data (5 minutes)
    this.setCacheTTL(5 * 60 * 1000);
  }

  /**
   * Get kills for a specific character within a date range
   */
  async getKillsForCharacter(
    characterId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    return this.executeQuery(
      () =>
        (this.prisma as any).killFact.findMany({
          where: {
            character_id: BigInt(characterId),
            kill_time: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: {
            kill_time: "asc",
          },
        }),
      `kills-${characterId}-${startDate.toISOString()}-${endDate.toISOString()}`
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

    return this.executeQuery(
      () =>
        (this.prisma as any).killFact.findMany({
          where: {
            character_id: {
              in: bigIntIds,
            },
            kill_time: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: {
            kill_time: "asc",
          },
        }),
      `kills-multiple-${characterIds.join(
        "-"
      )}-${startDate.toISOString()}-${endDate.toISOString()}`
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
      const characterIds = group.characters.map((c) => c.eveId);

      // Get kills for all characters
      return this.getKillsForCharacters(characterIds, startDate, endDate);
    }, `kills-group-${groupId}-${startDate.toISOString()}-${endDate.toISOString()}`);
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
      const soloKills = kills.filter((k) => k.solo === true).length;
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
    }, `kill-stats-${characterId}-${startDate.toISOString()}-${endDate.toISOString()}`);
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
      const soloKills = kills.filter((k) => k.solo === true).length;
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
    }, `group-kill-stats-${groupId}-${startDate.toISOString()}-${endDate.toISOString()}`);
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
      const groupCharacterIds = group.characters.map((c) => c.eveId);

      // Get all kills for this group in this time period
      const kills = await this.getKillsForGroup(groupId, startDate, endDate);

      if (kills.length === 0) {
        return {
          ...basicStats,
          groupSoloKills: 0,
        };
      }

      // Create a list of killmail IDs to query
      const killmailIds = kills.map((k) => k.killmail_id);

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

          // Check if all attackers with character IDs are from this group
          const playerAttackers = kill.attackers.filter((a) => a.character_id);
          if (playerAttackers.length === 0) {
            continue;
          }

          // Get all character IDs as strings for comparison
          const attackerCharIds = playerAttackers
            .map((a) => (a.character_id ? String(a.character_id) : null))
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
    }, `group-kill-stats-enhanced-${groupId}-${startDate.toISOString()}-${endDate.toISOString()}`);
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
    }, `kills-grouped-${characterIds.join("-")}-${startDate.toISOString()}-${endDate.toISOString()}-${groupBy}`);
  }

  /**
   * Get the top ship types destroyed within a date range
   */
  async getTopShipTypesDestroyed(
    characterIds: string[],
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<
    Array<{ shipTypeId: string; shipTypeName: string; count: number }>
  > {
    return this.executeQuery(async () => {
      // Convert strings to BigInts for query
      const bigIntIds = characterIds.map((id) => BigInt(id));

      // Get all kills for the characters in the specified date range
      const kills = await (this.prisma as any).killFact.findMany({
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
          ship_type_id: true,
          ship_type_name: true,
        },
      });

      // Group kills by ship type
      const shipTypeCounts = new Map<
        string,
        { id: string; name: string; count: number }
      >();

      for (const kill of kills) {
        const shipTypeId = kill.ship_type_id.toString();
        const shipTypeName = kill.ship_type_name || "Unknown Ship Type";

        if (shipTypeCounts.has(shipTypeId)) {
          shipTypeCounts.get(shipTypeId)!.count++;
        } else {
          shipTypeCounts.set(shipTypeId, {
            id: shipTypeId,
            name: shipTypeName,
            count: 1,
          });
        }
      }

      // Convert to array and sort by count
      const result = Array.from(shipTypeCounts.values())
        .map((item) => ({
          shipTypeId: item.id,
          shipTypeName: item.name,
          count: item.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return result;
    }, `top-ship-types-${characterIds.join("-")}-${startDate.toISOString()}-${endDate.toISOString()}`);
  }

  /**
   * Get ship types destroyed over time within a date range
   */
  async getShipTypesOverTime(
    characterIds: string[],
    startDate: Date,
    endDate: Date,
    limit: number = 5
  ): Promise<Record<string, Record<string, { name: string; count: number }>>> {
    return this.executeQuery(async () => {
      // Convert strings to BigInts for query
      const bigIntIds = characterIds.map((id) => BigInt(id));

      // Get all kills for the characters in the specified date range
      const kills = await (this.prisma as any).killFact.findMany({
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
          ship_type_name: true,
        },
      });

      // First, find the top ship types overall
      const shipTypeCounts = new Map<string, { name: string; count: number }>();

      for (const kill of kills) {
        const shipTypeId = kill.ship_type_id.toString();
        const shipTypeName = kill.ship_type_name || "Unknown Ship Type";

        if (shipTypeCounts.has(shipTypeId)) {
          shipTypeCounts.get(shipTypeId)!.count++;
        } else {
          shipTypeCounts.set(shipTypeId, { name: shipTypeName, count: 1 });
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
        Record<string, { name: string; count: number }>
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
          const shipType = shipTypeCounts.get(shipTypeId)!;
          resultByDate[dateKey][shipTypeId] = { name: shipType.name, count: 0 };
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
              name: kill.ship_type_name || "Unknown Ship Type",
              count: 0,
            };
          }

          resultByDate[dateKey][shipTypeId].count++;
        }
      }

      return resultByDate;
    }, `ship-types-over-time-${characterIds.join("-")}-${startDate.toISOString()}-${endDate.toISOString()}`);
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

      // Get all kills for the characters in the specified date range
      const kills = await (this.prisma as any).killFact.findMany({
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
          attacker_count: true,
        },
      });

      // Transform the data
      return kills.map(
        (kill: { killmail_id: bigint; attacker_count: number }) => ({
          killmailId: kill.killmail_id.toString(),
          attackerCount: Number(kill.attacker_count),
        })
      );
    }, `kills-with-attacker-count-${characterIds.join("-")}-${startDate.toISOString()}-${endDate.toISOString()}`);
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

      // Get all kills for the characters in the specified date range
      const kills = await (this.prisma as any).killFact.findMany({
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
          victim_corporation_id: true,
          victim_corporation_name: true,
        },
      });

      // Group kills by victim corporation
      const corpKillCounts = new Map<
        string,
        { id: string; name: string; count: number }
      >();

      for (const kill of kills) {
        const corpId = kill.victim_corporation_id.toString();
        const corpName = kill.victim_corporation_name || "Unknown Corporation";

        if (corpKillCounts.has(corpId)) {
          corpKillCounts.get(corpId)!.count++;
        } else {
          corpKillCounts.set(corpId, {
            id: corpId,
            name: corpName,
            count: 1,
          });
        }
      }

      // Convert to array and sort by kill count
      const result = Array.from(corpKillCounts.values())
        .map((item) => ({
          corpId: item.id,
          corpName: item.name,
          killCount: item.count,
        }))
        .sort((a, b) => b.killCount - a.killCount)
        .slice(0, limit);

      return result;
    }, `top-enemy-corps-${characterIds.join("-")}-${startDate.toISOString()}-${endDate.toISOString()}`);
  }

  /**
   * Get the total number of kills by corporation
   */
  async getTotalEnemyCorporationKills(
    characterIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    return this.executeQuery(async () => {
      // Convert strings to BigInts for query
      const bigIntIds = characterIds.map((id) => BigInt(id));

      // Get count of all kills for the characters in the specified date range
      const { _count } = await (this.prisma as any).killFact.aggregate({
        where: {
          character_id: {
            in: bigIntIds,
          },
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
      });

      return _count || 0;
    }, `total-enemy-corps-kills-${characterIds.join("-")}-${startDate.toISOString()}-${endDate.toISOString()}`);
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
      const kills = await (this.prisma as any).killFact.findMany({
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
    }, `kill-activity-heatmap-${characterIds.join("-")}-${startDate.toISOString()}-${endDate.toISOString()}`);
  }
}
