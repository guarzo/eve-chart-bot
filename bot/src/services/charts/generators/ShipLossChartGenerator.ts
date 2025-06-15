import { BaseChartGenerator } from '../BaseChartGenerator';
import { ChartData } from '../../../types/chart';
import { ShipTypesChartConfig } from '../config/ShipTypesChartConfig';
import { LossRepository } from '../../../infrastructure/repositories/LossRepository';
import { format } from 'date-fns';
import { logger } from '../../../lib/logger';
import axios from 'axios';
import { RepositoryManager } from '../../../infrastructure/repositories/RepositoryManager';

export class ShipLossChartGenerator extends BaseChartGenerator {
  private lossRepository: LossRepository;
  private shipTypeNameCache: Record<string, string> = {};

  /**
   * Create a new ship loss chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    this.lossRepository = this.repoManager.getLossRepository();
  }

  async generateChart(options: {
    startDate: Date;
    endDate: Date;
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>;
    displayType: string;
  }): Promise<ChartData> {
    try {
      const { startDate, endDate, characterGroups, displayType } = options;
      logger.info(`Generating ship loss chart from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      logger.debug(`Chart type: ${displayType}, Groups: ${characterGroups.length}`);
      if (displayType === 'horizontalBar') {
        return this.generateHorizontalBarChart(characterGroups, startDate, endDate);
      } else if (displayType === 'verticalBar') {
        return this.generateVerticalBarChart(characterGroups, startDate, endDate);
      } else {
        return this.generateTimelineChart(characterGroups, startDate, endDate);
      }
    } catch (error) {
      logger.error('Error generating ship loss chart:', error);
      throw error;
    }
  }

  private async getShipTypeName(typeId: string): Promise<string> {
    if (this.shipTypeNameCache[typeId]) return this.shipTypeNameCache[typeId];
    try {
      const resp = await axios.get(`https://esi.evetech.net/latest/universe/types/${typeId}/?datasource=tranquility`);
      const name = resp.data.name || typeId;
      this.shipTypeNameCache[typeId] = name;
      return name;
    } catch {
      return typeId;
    }
  }

  private async generateHorizontalBarChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    const characterIds = characterGroups.flatMap(group => group.characters).map(character => BigInt(character.eveId));
    if (characterIds.length === 0) {
      throw new Error('No characters found in the provided groups');
    }
    const shipTypesData = await this.lossRepository.getTopShipTypesLost(characterIds, startDate, endDate, 15);
    if (shipTypesData.length === 0) {
      throw new Error('No ship type data found for the specified time period');
    }
    const shipTypeNames = await Promise.all(shipTypesData.map(type => this.getShipTypeName(type.shipTypeId)));
    const filtered = shipTypesData
      .map((type, i) => ({ ...type, name: shipTypeNames[i] }))
      .filter(entry => entry.name.toLowerCase() !== 'capsule');
    if (filtered.length === 0) {
      throw new Error('No ship type data found for the specified time period (after filtering capsules)');
    }
    filtered.sort((a, b) => b.count - a.count);
    const totalLost = filtered.reduce((sum, shipType) => sum + shipType.count, 0);
    const chartData: ChartData = {
      labels: filtered.map(type => type.name),
      datasets: [
        {
          label: 'Ships Lost',
          data: filtered.map(type => type.count),
          backgroundColor: this.getVisibleColors(
            filtered.map(type => type.count),
            ShipTypesChartConfig.colors
          ),
          borderColor: ShipTypesChartConfig.colors.map(color => this.adjustColorBrightness(color, -20)),
        },
      ],
      displayType: 'bar',
      options: {
        indexAxis: 'y',
      },
      title: `${ShipTypesChartConfig.title} - ${format(startDate, 'MMM d')} to ${format(endDate, 'MMM d, yyyy')}`,
      summary: ShipTypesChartConfig.getDefaultSummary(filtered.length, totalLost),
    };
    return chartData;
  }

  private async generateVerticalBarChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    const chartData = await this.generateHorizontalBarChart(characterGroups, startDate, endDate);
    chartData.options = ShipTypesChartConfig.verticalBarOptions;
    chartData.displayType = 'bar';
    return chartData;
  }

  private async generateTimelineChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // For now, just show a bar chart (timeline for losses is less common)
    return this.generateHorizontalBarChart(characterGroups, startDate, endDate);
  }
}
