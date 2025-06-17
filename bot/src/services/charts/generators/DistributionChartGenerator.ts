import { BaseChartGenerator } from '../BaseChartGenerator';
import { ChartData } from '../../../types/chart';
import { KillRepository } from '../../../infrastructure/repositories/KillRepository';
import { RepositoryManager } from '../../../infrastructure/repositories/RepositoryManager';

// DistributionData interface removed - using kill data from repository

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

    // Get kill data for all characters
    const kills = await this.killRepository.getKillsForCharacters(characterIds, startDate, endDate);

    // Group data by character group
    const groupData = characterGroups.map(group => {
      const groupCharacterIds = group.characters.map(c => BigInt(c.eveId));
      const groupKills = kills.filter(kill =>
        kill.attackers?.some((attacker: any) => groupCharacterIds.includes(BigInt(attacker.characterId || '0')))
      );

      // Calculate solo and group kills based on attacker count
      const soloKills = groupKills.filter(kill => (kill.attackers?.length || 0) === 1).length;
      const fleetKills = groupKills.filter(kill => (kill.attackers?.length || 0) > 1).length;

      return {
        group,
        data: groupKills,
        soloKills,
        groupKills: fleetKills,
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
      displayType: 'horizontalBar',
    };
  }
}
