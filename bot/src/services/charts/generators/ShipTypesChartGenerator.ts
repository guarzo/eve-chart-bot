import { BaseChartGenerator } from '../BaseChartGenerator';
import { ChartData } from '../../../types/chart';
import { RepositoryManager } from '../../../infrastructure/repositories/RepositoryManager';
import { KillRepository } from '../../../infrastructure/repositories/KillRepository';
import { ChartLayoutUtils } from '../utils/ChartLayoutUtils';
import { TimeUtils } from '../utils/TimeUtils';

// ShipTypeData interface removed - using inline type from repository

/**
 * Generator for ship types chart
 */
export class ShipTypesChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;

  /**
   * Create a new ship types chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    this.killRepository = this.repoManager.getKillRepository();
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
    const characterIds = characterGroups.flatMap(group => group.characters.map(c => BigInt(c.eveId)));

    // Get ship types for all characters
    const shipTypes = await this.killRepository.getTopShipTypesDestroyed(characterIds, startDate, endDate, 100);

    // Group ship types by character group
    const groupData = characterGroups.map(group => {
      // For ship types, we need to check which character groups were affected
      // This is a placeholder implementation since the actual logic would need victim data
      const groupShipTypes = shipTypes;

      // Calculate total ships
      const totalShips = groupShipTypes.reduce((sum, data) => sum + data.count, 0);

      return {
        group,
        shipTypes: groupShipTypes,
        totalShips,
      };
    });

    // Sort groups by total ships
    groupData.sort((a, b) => (b.totalShips as number) - (a.totalShips as number));

    // Create chart data using the layout utility
    return ChartLayoutUtils.createHorizontalBarLayout(
      groupData.map(data => this.getGroupDisplayName(data.group)),
      [
        {
          label: 'Total Ships',
          data: groupData.map(data => data.totalShips as number),
          backgroundColor: this.getDatasetColors('shiptypes').primary,
        },
      ],
      `Ship Types Destroyed (${TimeUtils.formatTimeRange(startDate, endDate)})`
    );
  }
}
