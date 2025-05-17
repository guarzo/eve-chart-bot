import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData, ChartDisplayType } from "../../../types/chart";
import { KillRepository } from "../../../data/repositories/KillRepository";

interface ShipTypeData {
  shipTypeId: string;
  count: number;
}

/**
 * Generator for ship types chart
 */
export class ShipTypesChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;

  constructor() {
    super();
    this.killRepository = new KillRepository();
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
    const { startDate, endDate, characterGroups } = options;

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

}
