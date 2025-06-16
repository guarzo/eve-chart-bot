/**
 * Efficiency Data Processor
 * Domain service for processing efficiency-related chart data
 */

import { ChartData, ChartDataset, ChartMetadata } from '../../value-objects/ChartData';
import { ChartConfiguration } from '../../value-objects/ChartConfiguration';
import { ChartType } from '../../../../../shared/types/common';
import { IChartDataProcessor } from '../IChartDataProcessor';
import { KillDataPoint } from './KillsDataProcessor';
import { LossDataPoint } from './LossDataProcessor';

export interface EfficiencyAggregation {
  label: string;
  kills: number;
  losses: number;
  efficiency: number;
  iskDestroyed: bigint;
  iskLost: bigint;
  iskEfficiency: number;
}

export class EfficiencyDataProcessor implements IChartDataProcessor {
  /**
   * Process raw data based on configuration
   */
  async processData(config: ChartConfiguration, rawData: any[]): Promise<ChartData> {
    const { killData, lossData } = this.separateKillsAndLosses(rawData);
    return this.processEfficiencyData(config, killData, lossData, ['Default Group']);
  }

  /**
   * Validate configuration for efficiency processor
   */
  validateConfiguration(config: ChartConfiguration): boolean {
    return config.startDate && config.endDate && config.endDate > config.startDate;
  }

  /**
   * Separate raw data into kills and losses
   */
  private separateKillsAndLosses(rawData: any[]): { killData: KillDataPoint[], lossData: LossDataPoint[] } {
    const killData: KillDataPoint[] = rawData
      .filter(item => item.type === 'kill' || item.isKill)
      .map(item => ({
        killTime: new Date(item.killTime),
        killmailId: BigInt(item.killmailId),
        characterId: BigInt(item.characterId),
        groupId: item.groupId,
        solo: Boolean(item.solo),
        npc: Boolean(item.npc)
      }));
    
    const lossData: LossDataPoint[] = rawData
      .filter(item => item.type === 'loss' || item.isLoss)
      .map(item => ({
        killTime: new Date(item.killTime),
        killmailId: BigInt(item.killmailId),
        characterId: BigInt(item.characterId),
        groupId: item.groupId,
        totalValue: BigInt(item.totalValue || 0),
        shipTypeId: Number(item.shipTypeId),
        systemId: Number(item.systemId)
      }));
    
    return { killData, lossData };
  }

  /**
   * Process kill and loss data into efficiency chart format
   */
  processEfficiencyData(
    config: ChartConfiguration,
    killData: KillDataPoint[],
    lossData: LossDataPoint[],
    groupLabels: string[]
  ): ChartData {
    const startTime = Date.now();
    
    // Calculate efficiency metrics for each group
    const aggregations = this.calculateEfficiency(
      killData,
      lossData,
      groupLabels,
      config
    );
    
    // Create datasets for the chart
    const datasets = this.createEfficiencyDatasets(aggregations, config);
    
    // Extract labels
    const labels = aggregations.map(agg => agg.label);
    
    const metadata = new ChartMetadata(
      new Date(),
      killData.length + lossData.length,
      Date.now() - startTime,
      false
    );
    
    return new ChartData(ChartType.EFFICIENCY, labels, datasets, metadata);
  }

  /**
   * Calculate efficiency metrics for each group
   */
  private calculateEfficiency(
    killData: KillDataPoint[],
    lossData: LossDataPoint[],
    groupLabels: string[],
    _config: ChartConfiguration
  ): EfficiencyAggregation[] {
    const aggregations: Map<string, EfficiencyAggregation> = new Map();
    
    // Initialize aggregations
    groupLabels.forEach(label => {
      aggregations.set(label, {
        label,
        kills: 0,
        losses: 0,
        efficiency: 0,
        iskDestroyed: BigInt(0),
        iskLost: BigInt(0),
        iskEfficiency: 0
      });
    });
    
    // Count kills
    killData.forEach(kill => {
      const groupLabel = this.determineGroupLabel(kill, groupLabels);
      const agg = aggregations.get(groupLabel);
      if (agg) {
        agg.kills++;
        // Note: We'd need ISK destroyed data here - simplified for now
      }
    });
    
    // Count losses and ISK lost
    lossData.forEach(loss => {
      const groupLabel = this.determineGroupLabel(loss, groupLabels);
      const agg = aggregations.get(groupLabel);
      if (agg) {
        agg.losses++;
        agg.iskLost = agg.iskLost + loss.totalValue;
      }
    });
    
    // Calculate efficiency percentages
    aggregations.forEach(agg => {
      // Kill/Death efficiency
      const total = agg.kills + agg.losses;
      agg.efficiency = total > 0 ? (agg.kills / total) * 100 : 0;
      
      // ISK efficiency (simplified without ISK destroyed data)
      // In a real implementation, we'd calculate: iskDestroyed / (iskDestroyed + iskLost)
      agg.iskEfficiency = 0; // Placeholder
    });
    
    return Array.from(aggregations.values());
  }

  /**
   * Create chart datasets from efficiency data
   */
  private createEfficiencyDatasets(
    aggregations: EfficiencyAggregation[],
    config: ChartConfiguration
  ): ChartDataset[] {
    const datasets: ChartDataset[] = [];
    
    // Main efficiency percentage dataset
    datasets.push(new ChartDataset(
      'Efficiency %',
      aggregations.map(agg => Math.round(agg.efficiency * 10) / 10),
      this.getChartColor('efficiency'),
      this.getChartColor('efficiencyBorder'),
      3,
      true
    ));
    
    // Kill/Loss counts (if requested)
    if (config.displayOptions.showKillLossCounts === true) {
      datasets.push(new ChartDataset(
        'Kills',
        aggregations.map(agg => agg.kills),
        this.getChartColor('kills'),
        this.getChartColor('killsBorder'),
        2,
        false
      ));
      
      datasets.push(new ChartDataset(
        'Losses',
        aggregations.map(agg => agg.losses),
        this.getChartColor('losses'),
        this.getChartColor('lossesBorder'),
        2,
        false
      ));
    }
    
    return datasets;
  }

  /**
   * Determine which group a data point belongs to
   */
  private determineGroupLabel(
    dataPoint: KillDataPoint | LossDataPoint,
    groupLabels: string[]
  ): string {
    return dataPoint.groupId || groupLabels[0] || 'Unknown';
  }

  /**
   * Get chart colors based on type
   */
  private getChartColor(type: string): string {
    const colorMap: Record<string, string> = {
      efficiency: '#9C27B0',
      efficiencyBorder: '#7B1FA2',
      kills: '#4CAF50',
      killsBorder: '#388E3C',
      losses: '#F44336',
      lossesBorder: '#D32F2F'
    };
    
    return colorMap[type] || '#9E9E9E';
  }
}