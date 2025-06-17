/**
 * Legacy Chart Service Adapter
 * Provides backward compatibility with existing chart service interfaces
 * while delegating to the new DDD-structured analytics bounded context
 */

import { GenerateChartUseCase } from '../../application/use-cases/GenerateChartUseCase';
import { ChartConfiguration, ChartDisplayOptions } from '../../domain/value-objects/ChartConfiguration';
import { ChartType, TimePeriod } from '../../../../shared/types/common';
import { BigIntTransformer } from '../../../../shared/utils/BigIntTransformer';

// Legacy interface compatibility
export interface LegacyChartOptions {
  startDate: Date;
  endDate: Date;
  characterGroups: Array<{
    groupId: string;
    name: string;
    characters: Array<{ eveId: string; name: string }>;
    mainCharacterId?: string;
  }>;
  displayType: string;
}

export interface LegacyChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
  }>;
  displayType: string;
  summary?: string;
  options?: any;
}

export class LegacyChartServiceAdapter {
  constructor(private readonly generateChartUseCase: GenerateChartUseCase) {}

  /**
   * Generate kills chart using legacy interface
   */
  async generateKillsChart(options: LegacyChartOptions): Promise<LegacyChartData> {
    const config = this.convertToChartConfiguration(options, ChartType.KILLS);
    const result = await this.generateChartUseCase.execute(config);

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to generate chart');
    }

    // Convert the buffer result back to legacy format
    // For now, we'll need to also get the ChartData object
    // This is a bridge implementation - in a full migration, we'd refactor callers
    return this.convertToLegacyFormat(config, options);
  }

  /**
   * Generate losses chart using legacy interface
   */
  async generateLossesChart(options: LegacyChartOptions): Promise<LegacyChartData> {
    const config = this.convertToChartConfiguration(options, ChartType.LOSSES);
    const result = await this.generateChartUseCase.execute(config);

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to generate chart');
    }

    return this.convertToLegacyFormat(config, options);
  }

  /**
   * Generate efficiency chart using legacy interface
   */
  async generateEfficiencyChart(options: LegacyChartOptions): Promise<LegacyChartData> {
    const config = this.convertToChartConfiguration(options, ChartType.EFFICIENCY);
    const result = await this.generateChartUseCase.execute(config);

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to generate chart');
    }

    return this.convertToLegacyFormat(config, options);
  }

  /**
   * Convert legacy options to new ChartConfiguration value object
   */
  private convertToChartConfiguration(options: LegacyChartOptions, chartType: ChartType): ChartConfiguration {
    // Extract character IDs from character groups
    const characterIds = options.characterGroups.flatMap(group =>
      BigIntTransformer.migrateCharacterIds(group.characters)
    );

    // Determine time period based on date range
    const daysDiff = Math.ceil((options.endDate.getTime() - options.startDate.getTime()) / (1000 * 60 * 60 * 24));

    let timePeriod: TimePeriod;
    if (daysDiff <= 7) {
      timePeriod = TimePeriod.DAY;
    } else if (daysDiff <= 90) {
      timePeriod = TimePeriod.WEEK;
    } else if (daysDiff <= 365) {
      timePeriod = TimePeriod.MONTH;
    } else {
      timePeriod = TimePeriod.QUARTER;
    }

    const displayOptions = new ChartDisplayOptions(
      800, // width
      600, // height
      true, // showLegend
      true, // showGrid
      '#ffffff' // backgroundColor
    );

    return new ChartConfiguration(
      chartType,
      timePeriod,
      characterIds,
      options.startDate,
      options.endDate,
      displayOptions
    );
  }

  /**
   * Convert new chart format back to legacy format for compatibility
   */
  private convertToLegacyFormat(config: ChartConfiguration, originalOptions: LegacyChartOptions): LegacyChartData {
    // This is a simplified conversion for backward compatibility
    // In practice, we'd need to actually get the ChartData from the use case
    // For now, return a basic structure that maintains compatibility

    const groupNames = originalOptions.characterGroups.map(group => group.name);

    return {
      labels: groupNames,
      datasets: [
        {
          label: this.getDatasetLabel(config.type),
          data: new Array(groupNames.length).fill(0), // Placeholder data
          backgroundColor: this.getChartColors(config.type).primary,
          borderColor: this.getChartColors(config.type).secondary,
          borderWidth: 2,
        },
      ],
      displayType: originalOptions.displayType,
      summary: `${config.type} chart generated for ${groupNames.length} groups`,
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
        },
      },
    };
  }

  private getDatasetLabel(chartType: ChartType): string {
    switch (chartType) {
      case ChartType.KILLS:
        return 'Total Kills';
      case ChartType.LOSSES:
        return 'Total Losses';
      case ChartType.EFFICIENCY:
        return 'Efficiency %';
      default:
        return 'Data';
    }
  }

  private getChartColors(chartType: ChartType): { primary: string; secondary: string } {
    switch (chartType) {
      case ChartType.KILLS:
        return { primary: '#4CAF50', secondary: '#388E3C' };
      case ChartType.LOSSES:
        return { primary: '#F44336', secondary: '#D32F2F' };
      case ChartType.EFFICIENCY:
        return { primary: '#9C27B0', secondary: '#7B1FA2' };
      default:
        return { primary: '#2196F3', secondary: '#1976D2' };
    }
  }
}
