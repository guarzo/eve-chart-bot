import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData, ChartDisplayType } from "../../../types/chart";
import { ShipTypesChartConfig } from "../config";
import { logger } from "../../../lib/logger";
import { KillRepository } from "../../../data/repositories/KillRepository";
import { LossRepository } from "../../../data/repositories/LossRepository";
import { format } from "date-fns";
import axios from "axios";

interface ShipTypeData {
  shipTypeId: string;
  count: number;
}

/**
 * Generator for ship types chart
 */
export class ShipTypesChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;
  private lossRepository: LossRepository;
  private shipTypeNameCache: Record<string, string> = {};

  constructor() {
    super();
    this.killRepository = new KillRepository();
    this.lossRepository = new LossRepository();
  }

  /**
   * Generate a ship types chart
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

    // Get ship types for all characters
    const shipTypes = await this.killRepository.getTopShipTypesDestroyed(
      characterIds.map((id) => id.toString()),
      startDate,
      endDate
    );

    // Group ship types by character group
    const groupData = characterGroups.map((group) => {
      const groupCharacterIds = group.characters.map((c) => BigInt(c.eveId));
      const groupShipTypes = shipTypes.filter((data: ShipTypeData) =>
        groupCharacterIds.includes(BigInt(data.shipTypeId))
      );

      // Calculate total ships
      const totalShips = groupShipTypes.reduce(
        (sum: number, data: ShipTypeData) => sum + data.count,
        0
      );

      return {
        group,
        shipTypes: groupShipTypes,
        totalShips,
      };
    });

    // Sort groups by total ships
    groupData.sort((a, b) => b.totalShips - a.totalShips);

    // Create chart data
    return {
      labels: groupData.map((data) => this.getGroupDisplayName(data.group)),
      datasets: [
        {
          label: "Total Ships",
          data: groupData.map((data) => data.totalShips),
          backgroundColor: this.getDatasetColors("shiptypes").primary,
        },
      ],
      displayType: "horizontalBar" as ChartDisplayType,
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

  /**
   * Helper to fetch ship type name from ESI and cache it
   */
  private async getShipTypeName(typeId: string): Promise<string> {
    if (this.shipTypeNameCache[typeId]) return this.shipTypeNameCache[typeId];
    try {
      const resp = await axios.get(
        `https://esi.evetech.net/latest/universe/types/${typeId}/?datasource=tranquility`
      );
      const name = resp.data.name || typeId;
      this.shipTypeNameCache[typeId] = name;
      return name;
    } catch {
      return typeId;
    }
  }
}
