import { Prisma } from "@prisma/client";
import { Killmail } from "../../domain/killmail/Killmail";
import { PrismaMapper } from "../mapper/PrismaMapper";
import { BaseRepository } from "./BaseRepository";

/**
 * Repository for accessing kill-related data
 */
export class KillRepository extends BaseRepository {
  constructor() {
    super("Kill");
  }

  /**
   * Get a killmail by its ID
   */
  async getKillmail(killmailId: string | bigint): Promise<Killmail | null> {
    return this.executeQuery(async () => {
      const killmail = await this.prisma.killFact.findUnique({
        where: { killmail_id: BigInt(killmailId) },
        include: {
          attackers: true,
          victims: true,
        },
      });
      return killmail ? PrismaMapper.map(killmail, Killmail) : null;
    });
  }

  /**
   * Get killmails for a character
   */
  async getCharacterKillmails(
    characterId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<Killmail[]> {
    return this.executeQuery(async () => {
      const { startDate, endDate, limit } = options;

      const where: Prisma.KillFactWhereInput = {
        OR: [
          { victims: { some: { character_id: BigInt(characterId) } } },
          { attackers: { some: { character_id: BigInt(characterId) } } },
        ],
      };

      if (startDate) {
        where.kill_time = { gte: startDate };
      }

      if (endDate) {
        where.kill_time = { lte: endDate };
      }

      const killmails = await this.prisma.killFact.findMany({
        where,
        include: {
          attackers: true,
          victims: true,
        },
        orderBy: {
          kill_time: "desc",
        },
        take: limit,
      });

      return PrismaMapper.mapArray(killmails, Killmail);
    });
  }

  /**
   * Get killmails for a group of characters
   */
  async getGroupKillmails(
    characterIds: string[],
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<Killmail[]> {
    return this.executeQuery(async () => {
      const { startDate, endDate, limit } = options;

      const where: Prisma.KillFactWhereInput = {
        OR: [
          {
            victims: {
              some: { character_id: { in: characterIds.map(BigInt) } },
            },
          },
          {
            attackers: {
              some: { character_id: { in: characterIds.map(BigInt) } },
            },
          },
        ],
      };

      if (startDate) {
        where.kill_time = { gte: startDate };
      }

      if (endDate) {
        where.kill_time = { lte: endDate };
      }

      const killmails = await this.prisma.killFact.findMany({
        where,
        include: {
          attackers: true,
          victims: true,
        },
        orderBy: {
          kill_time: "desc",
        },
        take: limit,
      });

      return PrismaMapper.mapArray(killmails, Killmail);
    });
  }

  /**
   * Save a killmail
   */
  async saveKillmail(killmail: Killmail): Promise<Killmail> {
    return this.executeQuery(async () => {
      const saved = await this.prisma.killFact.upsert({
        where: {
          killmail_id: BigInt(killmail.killmailId || "0"),
        },
        create: {
          killmail_id: BigInt(killmail.killmailId || "0"),
          kill_time: killmail.killTime || new Date(),
          npc: killmail.npc || false,
          solo: killmail.solo || false,
          awox: killmail.awox || false,
          ship_type_id: killmail.shipTypeId || 0,
          system_id: killmail.systemId || 0,
          labels: killmail.labels || [],
          total_value: BigInt(killmail.totalValue || 0),
          points: killmail.points || 0,
          attackers: {
            create:
              killmail.attackers?.map((a) => ({
                character_id: a.characterId ? BigInt(a.characterId) : null,
                corporation_id: a.corporationId
                  ? BigInt(a.corporationId)
                  : null,
                alliance_id: a.allianceId ? BigInt(a.allianceId) : null,
                damage_done: a.damageDone || 0,
                final_blow: a.finalBlow || false,
                security_status: a.securityStatus || 0,
                ship_type_id: a.shipTypeId || 0,
                weapon_type_id: a.weaponTypeId || 0,
              })) || [],
          },
          victims: killmail.victim
            ? {
                create: {
                  character_id: killmail.victim.characterId
                    ? BigInt(killmail.victim.characterId)
                    : null,
                  corporation_id: killmail.victim.corporationId
                    ? BigInt(killmail.victim.corporationId)
                    : null,
                  alliance_id: killmail.victim.allianceId
                    ? BigInt(killmail.victim.allianceId)
                    : null,
                  ship_type_id: killmail.victim.shipTypeId || 0,
                  damage_taken: killmail.victim.damageTaken || 0,
                },
              }
            : undefined,
          characters: {
            create: [
              // Add victim if present and tracked
              ...(killmail.victim?.characterId
                ? [
                    {
                      character_id: BigInt(killmail.victim.characterId),
                      role: "victim",
                    },
                  ]
                : []),
              // Add all attackers that are tracked
              ...(killmail.attackers?.map((a) => ({
                character_id: a.characterId ? BigInt(a.characterId) : BigInt(0),
                role: "attacker",
              })) || []),
            ].filter((rel) => rel.character_id !== BigInt(0)),
          },
        },
        update: {
          kill_time: killmail.killTime || new Date(),
          npc: killmail.npc || false,
          solo: killmail.solo || false,
          awox: killmail.awox || false,
          ship_type_id: killmail.shipTypeId || 0,
          system_id: killmail.systemId || 0,
          labels: killmail.labels || [],
          total_value: BigInt(killmail.totalValue || 0),
          points: killmail.points || 0,
          attackers: {
            deleteMany: {},
            create:
              killmail.attackers?.map((a) => ({
                character_id: a.characterId ? BigInt(a.characterId) : null,
                corporation_id: a.corporationId
                  ? BigInt(a.corporationId)
                  : null,
                alliance_id: a.allianceId ? BigInt(a.allianceId) : null,
                damage_done: a.damageDone || 0,
                final_blow: a.finalBlow || false,
                security_status: a.securityStatus || 0,
                ship_type_id: a.shipTypeId || 0,
                weapon_type_id: a.weaponTypeId || 0,
              })) || [],
          },
          victims: killmail.victim
            ? {
                deleteMany: {},
                create: {
                  character_id: killmail.victim.characterId
                    ? BigInt(killmail.victim.characterId)
                    : null,
                  corporation_id: killmail.victim.corporationId
                    ? BigInt(killmail.victim.corporationId)
                    : null,
                  alliance_id: killmail.victim.allianceId
                    ? BigInt(killmail.victim.allianceId)
                    : null,
                  ship_type_id: killmail.victim.shipTypeId || 0,
                  damage_taken: killmail.victim.damageTaken || 0,
                },
              }
            : undefined,
          characters: {
            deleteMany: {},
            create: [
              // Add victim if present and tracked
              ...(killmail.victim?.characterId
                ? [
                    {
                      character_id: BigInt(killmail.victim.characterId),
                      role: "victim",
                    },
                  ]
                : []),
              // Add all attackers that are tracked
              ...(killmail.attackers?.map((a) => ({
                character_id: a.characterId ? BigInt(a.characterId) : BigInt(0),
                role: "attacker",
              })) || []),
            ].filter((rel) => rel.character_id !== BigInt(0)),
          },
        },
      });

      return PrismaMapper.map(saved, Killmail);
    });
  }

  /**
   * Delete a killmail
   */
  async deleteKillmail(killmailId: string): Promise<void> {
    await this.prisma.killFact.delete({
      where: { killmail_id: BigInt(killmailId) },
    });
  }

  /**
   * Get killmail statistics for a character
   */
  async getCharacterStats(
    characterId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    totalKills: number;
    totalLosses: number;
    soloKills: number;
    awoxKills: number;
    totalValue: number;
    totalPoints: number;
  }> {
    const { startDate, endDate } = options;

    const where: Prisma.KillFactWhereInput = {
      OR: [
        { victims: { some: { character_id: BigInt(characterId) } } },
        { attackers: { some: { character_id: BigInt(characterId) } } },
      ],
    };

    if (startDate) {
      where.kill_time = { gte: startDate };
    }

    if (endDate) {
      where.kill_time = { lte: endDate };
    }

    const [kills, losses] = await Promise.all([
      this.prisma.killFact.findMany({
        where,
        select: {
          solo: true,
          awox: true,
          total_value: true,
          points: true,
        },
      }),
      this.prisma.lossFact.findMany({
        where: {
          character_id: BigInt(characterId),
          kill_time: {
            gte: startDate || new Date(0),
            lte: endDate || new Date(),
          },
        },
      }),
    ]);

    return {
      totalKills: kills.length,
      totalLosses: losses.length,
      soloKills: kills.filter((k) => k.solo).length,
      awoxKills: kills.filter((k) => k.awox).length,
      totalValue: Number(
        kills.reduce((sum, k) => sum + k.total_value, BigInt(0))
      ),
      totalPoints: kills.reduce((sum, k) => sum + k.points, 0),
    };
  }

  /**
   * Get kills for a list of characters within a date range
   */
  async getKillsForCharacters(
    characterIds: string | bigint | (string | bigint)[],
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const ids = Array.isArray(characterIds) ? characterIds : [characterIds];
    const bigIntIds = ids.map((id) => BigInt(id));

    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: { in: bigIntIds } } } },
          { attackers: { some: { character_id: { in: bigIntIds } } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        attackers: true,
        victims: true,
      },
      orderBy: {
        kill_time: "desc",
      },
    });

    return PrismaMapper.mapArray(kills, Killmail);
  }

  /**
   * Get kills for a character group within a date range
   */
  async getKillsForGroup(
    groupId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const group = await this.prisma.characterGroup.findUnique({
      where: { id: groupId },
      include: { characters: true },
    });

    if (!group) {
      return [];
    }

    const characterIds = group.characters.map((c) => BigInt(c.eveId));

    return this.getKillsForCharacters(characterIds, startDate, endDate);
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
    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: BigInt(characterId) } } },
          { attackers: { some: { character_id: BigInt(characterId) } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        solo: true,
        total_value: true,
      },
    });

    const totalKills = kills.length;
    const soloKills = kills.filter((k) => k.solo).length;
    const totalValue = kills.reduce((sum, k) => sum + k.total_value, BigInt(0));
    const averageValue =
      totalKills > 0 ? totalValue / BigInt(totalKills) : BigInt(0);

    return {
      totalKills,
      soloKills,
      totalValue,
      averageValue,
    };
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
    const group = await this.prisma.characterGroup.findUnique({
      where: { id: groupId },
      include: { characters: true },
    });

    if (!group) {
      return {
        totalKills: 0,
        soloKills: 0,
        totalValue: BigInt(0),
        averageValue: BigInt(0),
      };
    }

    const characterIds = group.characters.map((c) => BigInt(c.eveId));

    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: { in: characterIds } } } },
          { attackers: { some: { character_id: { in: characterIds } } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        solo: true,
        total_value: true,
      },
    });

    const totalKills = kills.length;
    const soloKills = kills.filter((k) => k.solo).length;
    const totalValue = kills.reduce((sum, k) => sum + k.total_value, BigInt(0));
    const averageValue =
      totalKills > 0 ? totalValue / BigInt(totalKills) : BigInt(0);

    return {
      totalKills,
      soloKills,
      totalValue,
      averageValue,
    };
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
    groupSoloKills: number;
    totalValue: bigint;
    averageValue: bigint;
  }> {
    const group = await this.prisma.characterGroup.findUnique({
      where: { id: groupId },
      include: { characters: true },
    });

    if (!group) {
      return {
        totalKills: 0,
        soloKills: 0,
        groupSoloKills: 0,
        totalValue: BigInt(0),
        averageValue: BigInt(0),
      };
    }

    const characterIds = group.characters.map((c) => BigInt(c.eveId));

    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: { in: characterIds } } } },
          { attackers: { some: { character_id: { in: characterIds } } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        attackers: true,
      },
    });

    const totalKills = kills.length;
    const soloKills = kills.filter((k) => k.solo).length;
    const groupSoloKills = kills.filter((k) => {
      if (!k.solo) return false;
      return k.attackers.every(
        (a) => a.character_id && characterIds.includes(a.character_id)
      );
    }).length;

    const totalValue = kills.reduce((sum, k) => sum + k.total_value, BigInt(0));
    const averageValue =
      totalKills > 0 ? totalValue / BigInt(totalKills) : BigInt(0);

    return {
      totalKills,
      soloKills,
      groupSoloKills,
      totalValue,
      averageValue,
    };
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
    const bigIntIds = characterIds.map(BigInt);

    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: { in: bigIntIds } } } },
          { attackers: { some: { character_id: { in: bigIntIds } } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        kill_time: true,
        total_value: true,
      },
      orderBy: {
        kill_time: "asc",
      },
    });

    const grouped = new Map<string, { kills: number; value: bigint }>();

    for (const kill of kills) {
      const key = this.getTimeKey(kill.kill_time, groupBy);
      const current = grouped.get(key) || { kills: 0, value: BigInt(0) };
      grouped.set(key, {
        kills: current.kills + 1,
        value: current.value + kill.total_value,
      });
    }

    return Array.from(grouped.entries()).map(([key, data]) => ({
      timestamp: new Date(key),
      kills: data.kills,
      value: data.value,
    }));
  }

  /**
   * Get the top ship types destroyed within a date range
   */
  async getTopShipTypesDestroyed(
    characterIds: (string | bigint)[],
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{ shipTypeId: string; count: number }>> {
    const bigIntIds = characterIds.map(BigInt);

    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: { in: bigIntIds } } } },
          { attackers: { some: { character_id: { in: bigIntIds } } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        ship_type_id: true,
      },
    });

    const counts = new Map<number, number>();
    for (const kill of kills) {
      counts.set(kill.ship_type_id, (counts.get(kill.ship_type_id) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([shipTypeId, count]) => ({
        shipTypeId: shipTypeId.toString(),
        count,
      }));
  }

  /**
   * Get ship types destroyed over time within a date range
   */
  async getShipTypesOverTime(
    characterIds: (string | bigint)[],
    startDate: Date,
    endDate: Date,
    limit: number = 5
  ): Promise<Record<string, Record<string, { count: number }>>> {
    const bigIntIds = characterIds.map(BigInt);

    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: { in: bigIntIds } } } },
          { attackers: { some: { character_id: { in: bigIntIds } } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        kill_time: true,
        ship_type_id: true,
      },
      orderBy: {
        kill_time: "asc",
      },
    });

    const result: Record<string, Record<string, { count: number }>> = {};
    const shipTypeCounts = new Map<number, number>();

    for (const kill of kills) {
      const dateKey = this.getTimeKey(kill.kill_time, "day");
      if (!result[dateKey]) {
        result[dateKey] = {};
      }

      const shipTypeId = kill.ship_type_id.toString();
      if (!result[dateKey][shipTypeId]) {
        result[dateKey][shipTypeId] = { count: 0 };
      }

      result[dateKey][shipTypeId].count++;
      shipTypeCounts.set(
        kill.ship_type_id,
        (shipTypeCounts.get(kill.ship_type_id) || 0) + 1
      );
    }

    // Get top N ship types
    const topShipTypes = Array.from(shipTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id.toString());

    // Filter result to only include top ship types
    for (const dateKey in result) {
      const filtered: Record<string, { count: number }> = {};
      for (const shipTypeId of topShipTypes) {
        if (result[dateKey][shipTypeId]) {
          filtered[shipTypeId] = result[dateKey][shipTypeId];
        }
      }
      result[dateKey] = filtered;
    }

    return result;
  }

  /**
   * Get kills with attacker count for distribution analysis
   */
  async getKillsWithAttackerCount(
    characterIds: (string | bigint)[],
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ killmailId: string; attackerCount: number }>> {
    const bigIntIds = characterIds.map(BigInt);

    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: { in: bigIntIds } } } },
          { attackers: { some: { character_id: { in: bigIntIds } } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        attackers: true,
      },
    });

    return kills.map((kill) => ({
      killmailId: kill.killmail_id.toString(),
      attackerCount: kill.attackers.length,
    }));
  }

  /**
   * Get top enemy corporations
   */
  async getTopEnemyCorporations(
    characterIds: string[],
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{ corpId: string; corpName: string; killCount: number }>> {
    const bigIntIds = characterIds.map(BigInt);

    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: { in: bigIntIds } } } },
          { attackers: { some: { character_id: { in: bigIntIds } } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        attackers: true,
      },
    });

    const corpCounts = new Map<string, { name: string; count: number }>();

    for (const kill of kills) {
      for (const attacker of kill.attackers) {
        if (attacker.corporation_id) {
          const corpId = attacker.corporation_id.toString();
          const current = corpCounts.get(corpId) || { name: corpId, count: 0 };
          corpCounts.set(corpId, {
            name: current.name,
            count: current.count + 1,
          });
        }
      }
    }

    return Array.from(corpCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([corpId, data]) => ({
        corpId,
        corpName: data.name,
        killCount: data.count,
      }));
  }

  /**
   * Get the total number of kills by corporation
   */
  async getTotalEnemyCorporationKills(
    characterIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const bigIntIds = characterIds.map(BigInt);

    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: { in: bigIntIds } } } },
          { attackers: { some: { character_id: { in: bigIntIds } } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        attackers: true,
      },
    });

    const uniqueCorps = new Set<string>();
    for (const kill of kills) {
      for (const attacker of kill.attackers) {
        if (attacker.corporation_id) {
          uniqueCorps.add(attacker.corporation_id.toString());
        }
      }
    }

    return uniqueCorps.size;
  }

  /**
   * Get kill activity grouped by hour and day of week for heatmap
   */
  async getKillActivityByTimeOfDay(
    characterIds: (string | bigint)[],
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ dayOfWeek: number; hourOfDay: number; kills: number }>> {
    const bigIntIds = characterIds.map(BigInt);

    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: { in: bigIntIds } } } },
          { attackers: { some: { character_id: { in: bigIntIds } } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        kill_time: true,
      },
    });

    const activity = new Map<string, number>();

    for (const kill of kills) {
      const date = kill.kill_time;
      const key = `${date.getDay()}-${date.getHours()}`;
      activity.set(key, (activity.get(key) || 0) + 1);
    }

    return Array.from(activity.entries()).map(([key, kills]) => {
      const [dayOfWeek, hourOfDay] = key.split("-").map(Number);
      return { dayOfWeek, hourOfDay, kills };
    });
  }

  /**
   * Get distribution data for a character
   */
  async getDistributionData(
    characterIds: (string | bigint)[],
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ killmailId: string; attackerCount: number }>> {
    const bigIntIds = characterIds.map(BigInt);

    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: { in: bigIntIds } } } },
          { attackers: { some: { character_id: { in: bigIntIds } } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        attackers: true,
      },
    });

    return kills.map((kill) => ({
      killmailId: kill.killmail_id.toString(),
      attackerCount: kill.attackers.length,
    }));
  }

  /**
   * Get the top ship types used by characters within a date range
   */
  async getTopShipTypesUsed(
    characterIds: (string | bigint)[],
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{ shipTypeId: string; count: number }>> {
    const bigIntIds = characterIds.map(BigInt);

    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: { in: bigIntIds } } } },
          { attackers: { some: { character_id: { in: bigIntIds } } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        attackers: true,
      },
    });

    const shipTypeCounts = new Map<number, number>();

    for (const kill of kills) {
      for (const attacker of kill.attackers) {
        if (attacker.ship_type_id) {
          shipTypeCounts.set(
            attacker.ship_type_id,
            (shipTypeCounts.get(attacker.ship_type_id) || 0) + 1
          );
        }
      }
    }

    return Array.from(shipTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([shipTypeId, count]) => ({
        shipTypeId: shipTypeId.toString(),
        count,
      }));
  }

  /**
   * Get all kills where a character participated (either as the main killer or as an attacker)
   * This ensures we don't miss kills where the character participated but wasn't the main character
   */
  async getAllKillsForCharacters(
    characterIds: (string | bigint)[],
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const bigIntIds = characterIds.map(BigInt);

    const kills = await this.prisma.killFact.findMany({
      where: {
        OR: [
          { victims: { some: { character_id: { in: bigIntIds } } } },
          { attackers: { some: { character_id: { in: bigIntIds } } } },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        attackers: true,
        victims: true,
      },
      orderBy: {
        kill_time: "desc",
      },
    });

    return PrismaMapper.mapArray(kills, Killmail);
  }

  /**
   * Count kills for a character
   */
  async countKills(): Promise<number> {
    return this.prisma.killFact.count();
  }

  /**
   * Count losses for a character
   */
  async countLosses(): Promise<number> {
    return this.prisma.lossFact.count();
  }

  /**
   * Get a loss by killmail ID
   */
  async getLoss(killmailId: bigint): Promise<any> {
    return this.prisma.lossFact.findUnique({
      where: { killmail_id: killmailId },
    });
  }

  /**
   * Save a loss record
   */
  async saveLoss(
    killmailId: bigint,
    killTime: Date,
    systemId: number,
    totalValue: number,
    attackerCount: number,
    labels: string[],
    characterId: bigint,
    shipTypeId: number
  ): Promise<void> {
    await this.prisma.lossFact.upsert({
      where: { killmail_id: killmailId },
      create: {
        killmail_id: killmailId,
        kill_time: killTime,
        system_id: systemId,
        total_value: BigInt(totalValue),
        attacker_count: attackerCount,
        labels,
        character_id: characterId,
        ship_type_id: shipTypeId,
      },
      update: {
        kill_time: killTime,
        system_id: systemId,
        total_value: BigInt(totalValue),
        attacker_count: attackerCount,
        labels,
        character_id: characterId,
        ship_type_id: shipTypeId,
      },
    });
  }

  /**
   * Delete all losses
   */
  async deleteAllLosses(): Promise<{ count: number }> {
    return this.prisma.lossFact.deleteMany();
  }

  /**
   * Delete all loss checkpoints
   */
  async deleteAllLossCheckpoints(): Promise<{ count: number }> {
    return this.prisma.ingestionCheckpoint.deleteMany({
      where: {
        streamName: {
          startsWith: "losses:",
        },
      },
    });
  }

  /**
   * Get time key
   */
  private getTimeKey(date: Date, groupBy: "hour" | "day" | "week"): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();

    switch (groupBy) {
      case "hour":
        return `${year}-${month.toString().padStart(2, "0")}-${day
          .toString()
          .padStart(2, "0")}T${hour.toString().padStart(2, "0")}:00:00Z`;
      case "day":
        return `${year}-${month.toString().padStart(2, "0")}-${day
          .toString()
          .padStart(2, "0")}T00:00:00Z`;
      case "week":
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.getFullYear()}-${(weekStart.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${weekStart
          .getDate()
          .toString()
          .padStart(2, "0")}T00:00:00Z`;
    }
  }

  /**
   * Get all kills for a character within a date range
   */
  async getKillsForCharacter(
    characterId: string | bigint,
    startDate: Date,
    endDate: Date
  ): Promise<Killmail[]> {
    return this.executeQuery(async () => {
      const kills = await this.prisma.killFact.findMany({
        where: {
          OR: [
            { victims: { some: { character_id: BigInt(characterId) } } },
            { attackers: { some: { character_id: BigInt(characterId) } } },
          ],
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          attackers: true,
          victims: true,
        },
        orderBy: {
          kill_time: "desc",
        },
      });

      return PrismaMapper.mapArray(kills, Killmail);
    });
  }

  /**
   * Get all kills in a system within a date range
   */
  async getKillsInSystem(
    systemId: string | number,
    startDate: Date,
    endDate: Date
  ): Promise<Killmail[]> {
    return this.executeQuery(async () => {
      const kills = await this.prisma.killFact.findMany({
        where: {
          system_id: Number(systemId),
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          attackers: true,
          victims: true,
        },
        orderBy: {
          kill_time: "desc",
        },
      });

      return PrismaMapper.mapArray(kills, Killmail);
    });
  }

  /**
   * Get all kills within a date range
   */
  async getKillsInDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<Killmail[]> {
    return this.executeQuery(async () => {
      const kills = await this.prisma.killFact.findMany({
        where: {
          kill_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          attackers: true,
          victims: true,
        },
        orderBy: {
          kill_time: "desc",
        },
      });

      return PrismaMapper.mapArray(kills, Killmail);
    });
  }

  /**
   * Deletes all killmails from the database
   */
  async deleteAllKillmails(): Promise<void> {
    await this.prisma.killFact.deleteMany();
  }
}
