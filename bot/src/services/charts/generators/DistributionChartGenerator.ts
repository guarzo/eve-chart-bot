import { BaseChartGenerator } from '../BaseChartGenerator';
import { ChartData, ChartDisplayType } from '../../../types/chart';
import { KillRepository } from '../../../infrastructure/repositories/KillRepository';
import { RepositoryManager } from '../../../infrastructure/repositories/RepositoryManager';

interface DistributionData {
  killmailId: string;
  attackerCount: number;
}

/**
 * Generator for distribution charts
 */
export class DistributionChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;

  /**
   * Create a new distribution chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    this.killRepository = this.repoManager.getKillRepository();
  }

  /**
   * Generate a kill distribution chart based on the provided options
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

    // Get distribution data for all characters
    const distributionData = await this.killRepository.getDistributionData(characterIds, startDate, endDate);

    // Group data by character group
    const groupData = characterGroups.map(group => {
      const groupCharacterIds = group.characters.map(c => BigInt(c.eveId));
      const groupData = distributionData.filter((data: DistributionData) =>
        groupCharacterIds.includes(BigInt(data.killmailId))
      );

      // Calculate solo and group kills
      const soloKills = groupData.filter((data: DistributionData) => data.attackerCount === 1).length;
      const groupKills = groupData.filter((data: DistributionData) => data.attackerCount > 1).length;

      return {
        group,
        data: groupData,
        soloKills,
        groupKills,
      };
    });

    // Sort groups by total kills
    groupData.sort((a, b) => b.soloKills + b.groupKills - (a.soloKills + a.groupKills));

    // Create chart data
    return {
      labels: groupData.map(data => this.getGroupDisplayName(data.group)),
      datasets: [
        {
          label: 'Solo Kills',
          data: groupData.map(data => data.soloKills),
          backgroundColor: this.getDatasetColors('distribution').primary,
        },
        {
          label: 'Group Kills',
          data: groupData.map(data => data.groupKills),
          backgroundColor: this.getDatasetColors('distribution').secondary,
        },
      ],
      displayType: 'horizontalBar' as ChartDisplayType,
    };
  }
}
