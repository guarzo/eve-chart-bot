import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData, ChartDisplayType } from "../../../types/chart";
import { MapActivityRepository } from "../../../infrastructure/repositories/MapActivityRepository";
import { RepositoryManager } from "../../../infrastructure/repositories/RepositoryManager";

interface MapActivity {
  allianceId: number | null;
  corporationId: number;
  timestamp: Date;
  characterId: bigint;
  signatures: number;
  connections: number;
  passages: number;
}

/**
 * Generator for map activity charts
 */
export class MapChartGenerator extends BaseChartGenerator {
  private mapActivityRepository: MapActivityRepository;

  /**
   * Create a new map activity chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    this.mapActivityRepository = this.repoManager.getMapActivityRepository();
  }

  /**
   * Generate a map activity chart based on the provided options
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

    // Get map activity for all characters
    const activities =
      await this.mapActivityRepository.getActivityForCharacters(
        characterIds.map((id) => id.toString()),
        startDate,
        endDate
      );

    // Group activities by character group
    const groupData = characterGroups.map((group) => {
      const groupCharacterIds = group.characters.map((c) => BigInt(c.eveId));
      const groupActivities = activities.filter((activity: MapActivity) =>
        groupCharacterIds.includes(activity.characterId)
      );

      // Calculate totals for each metric
      const totalSignatures = groupActivities.reduce(
        (sum: number, activity: MapActivity) => sum + activity.signatures,
        0
      );
      const totalConnections = groupActivities.reduce(
        (sum: number, activity: MapActivity) => sum + activity.connections,
        0
      );
      const totalPassages = groupActivities.reduce(
        (sum: number, activity: MapActivity) => sum + activity.passages,
        0
      );

      return {
        group,
        activities: groupActivities,
        totalSignatures,
        totalConnections,
        totalPassages,
      };
    });

    // Sort groups by total activity (sum of all metrics)
    groupData.sort(
      (a, b) =>
        b.totalSignatures +
        b.totalConnections +
        b.totalPassages -
        (a.totalSignatures + a.totalConnections + a.totalPassages)
    );

    // Create chart data
    return {
      labels: groupData.map((data) => this.getGroupDisplayName(data.group)),
      datasets: [
        {
          label: "Signatures",
          data: groupData.map((data) => data.totalSignatures),
          backgroundColor: this.getDatasetColors("map").primary,
        },
        {
          label: "Connections",
          data: groupData.map((data) => data.totalConnections),
          backgroundColor: this.getDatasetColors("map").secondary,
        },
        {
          label: "Passages",
          data: groupData.map((data) => data.totalPassages),
          backgroundColor: this.getColorForIndex(2),
        },
      ],
      displayType: "horizontalBar" as ChartDisplayType,
    };
  }
}
