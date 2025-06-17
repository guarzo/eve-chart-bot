/**
 * Kills Data Processor
 * Domain service for processing kill-related chart data
 */

import { ChartData, ChartDataset, ChartMetadata } from '../../value-objects/ChartData';
import { ChartConfiguration } from '../../value-objects/ChartConfiguration';
import { ChartType } from '../../../../../shared/types/common';
import { IChartDataProcessor } from '../IChartDataProcessor';

export interface KillDataPoint {
  killTime: Date;
  killmailId: bigint;
  characterId: bigint;
  groupId?: string;
  solo: boolean;
  npc: boolean;
}

export interface KillAggregation {
  label: string;
  totalKills: number;
  soloKills: number;
  npcKills: number;
  averagePerDay: number;
}

export class KillsDataProcessor implements IChartDataProcessor {
  /**
   * Process raw data based on configuration
   */
  async processData(config: ChartConfiguration, rawData: any[]): Promise<ChartData> {
    const killData = this.convertRawToKillData(rawData);
    const groupLabels = ['Default Group']; // Default grouping
    return this.processKillData(config, killData, groupLabels);
  }

  /**
   * Validate configuration for kills processor
   */
  validateConfiguration(config: ChartConfiguration): boolean {
    return config.startDate && config.endDate && config.endDate > config.startDate;
  }

  /**
   * Convert raw data to kill data points
   */
  private convertRawToKillData(rawData: any[]): KillDataPoint[] {
    return rawData.map(item => ({
      killTime: new Date(item.killTime),
      killmailId: BigInt(item.killmailId),
      characterId: BigInt(item.characterId),
      groupId: item.groupId,
      solo: Boolean(item.solo),
      npc: Boolean(item.npc),
    }));
  }

  /**
   * Process kill data points into chart-ready format
   */
  processKillData(config: ChartConfiguration, killData: KillDataPoint[], groupLabels: string[]): ChartData {
    const startTime = Date.now();

    // Group kills by the configured grouping (character, time, etc)
    const aggregations = this.aggregateKills(killData, groupLabels, config);

    // Create datasets for the chart
    const datasets = this.createKillDatasets(aggregations, config);

    // Extract labels
    const labels = aggregations.map(agg => agg.label);

    const metadata = new ChartMetadata(new Date(), killData.length, Date.now() - startTime, false);

    return new ChartData(ChartType.KILLS, labels, datasets, metadata);
  }

  /**
   * Aggregate kills by group
   */
  private aggregateKills(
    killData: KillDataPoint[],
    groupLabels: string[],
    config: ChartConfiguration
  ): KillAggregation[] {
    const aggregations: Map<string, KillAggregation> = new Map();

    // Initialize aggregations for each group
    groupLabels.forEach(label => {
      aggregations.set(label, {
        label,
        totalKills: 0,
        soloKills: 0,
        npcKills: 0,
        averagePerDay: 0,
      });
    });

    // Process each kill
    killData.forEach(kill => {
      const groupLabel = this.determineGroupLabel(kill, groupLabels);
      const agg = aggregations.get(groupLabel);

      if (agg) {
        agg.totalKills++;
        if (kill.solo) agg.soloKills++;
        if (kill.npc) agg.npcKills++;
      }
    });

    // Calculate averages
    const daysDiff = this.calculateDaysDifference(config.startDate, config.endDate);
    aggregations.forEach(agg => {
      agg.averagePerDay = daysDiff > 0 ? agg.totalKills / daysDiff : 0;
    });

    return Array.from(aggregations.values());
  }

  /**
   * Create chart datasets from aggregations
   */
  private createKillDatasets(aggregations: KillAggregation[], config: ChartConfiguration): ChartDataset[] {
    const datasets: ChartDataset[] = [];

    // Total kills dataset
    datasets.push(
      new ChartDataset(
        'Total Kills',
        aggregations.map(agg => agg.totalKills),
        this.getChartColor('primary'),
        this.getChartColor('primaryBorder'),
        2,
        false
      )
    );

    // Solo kills dataset (if requested)
    if (config.displayOptions.showSoloKills !== false) {
      datasets.push(
        new ChartDataset(
          'Solo Kills',
          aggregations.map(agg => agg.soloKills),
          this.getChartColor('secondary'),
          this.getChartColor('secondaryBorder'),
          2,
          false
        )
      );
    }

    // NPC kills dataset (if requested)
    if (config.displayOptions.showNpcKills === true) {
      datasets.push(
        new ChartDataset(
          'NPC Kills',
          aggregations.map(agg => agg.npcKills),
          this.getChartColor('tertiary'),
          this.getChartColor('tertiaryBorder'),
          2,
          false
        )
      );
    }

    return datasets;
  }

  /**
   * Determine which group a kill belongs to
   */
  private determineGroupLabel(kill: KillDataPoint, groupLabels: string[]): string {
    // Simple implementation - can be extended based on grouping logic
    return kill.groupId || groupLabels[0] || 'Unknown';
  }

  /**
   * Calculate days difference between dates
   */
  private calculateDaysDifference(start: Date, end: Date): number {
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Get chart colors based on theme
   */
  private getChartColor(type: string): string {
    const colorMap: Record<string, string> = {
      primary: '#4CAF50',
      primaryBorder: '#388E3C',
      secondary: '#2196F3',
      secondaryBorder: '#1976D2',
      tertiary: '#FF9800',
      tertiaryBorder: '#F57C00',
    };

    return colorMap[type] || '#9E9E9E';
  }
}
