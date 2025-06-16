/**
 * Loss Data Processor
 * Domain service for processing loss-related chart data
 */

import { ChartData, ChartDataset, ChartMetadata } from '../../value-objects/ChartData';
import { ChartConfiguration } from '../../value-objects/ChartConfiguration';
import { ChartType } from '../../../../../shared/types/common';
import { IChartDataProcessor } from '../IChartDataProcessor';

export interface LossDataPoint {
  killTime: Date;
  killmailId: bigint;
  characterId: bigint;
  groupId?: string;
  totalValue: bigint;
  shipTypeId: number;
  systemId: number;
}

export interface LossAggregation {
  label: string;
  totalLosses: number;
  totalValue: bigint;
  highValueLosses: number;
  averageValue: bigint;
  mostLostShipType?: number;
}

export class LossDataProcessor implements IChartDataProcessor {
  private readonly HIGH_VALUE_THRESHOLD = BigInt(100_000_000); // 100M ISK

  /**
   * Process raw data based on configuration
   */
  async processData(config: ChartConfiguration, rawData: any[]): Promise<ChartData> {
    const lossData = this.convertRawToLossData(rawData);
    const groupLabels = ['Default Group']; // Default grouping
    return this.processLossData(config, lossData, groupLabels);
  }

  /**
   * Validate configuration for loss processor
   */
  validateConfiguration(config: ChartConfiguration): boolean {
    return config.startDate && config.endDate && config.endDate > config.startDate;
  }

  /**
   * Convert raw data to loss data points
   */
  private convertRawToLossData(rawData: any[]): LossDataPoint[] {
    return rawData.map(item => ({
      killTime: new Date(item.killTime),
      killmailId: BigInt(item.killmailId),
      characterId: BigInt(item.characterId),
      groupId: item.groupId,
      totalValue: BigInt(item.totalValue || 0),
      shipTypeId: Number(item.shipTypeId),
      systemId: Number(item.systemId)
    }));
  }

  /**
   * Process loss data points into chart-ready format
   */
  processLossData(
    config: ChartConfiguration,
    lossData: LossDataPoint[],
    groupLabels: string[]
  ): ChartData {
    const startTime = Date.now();
    
    // Group losses by the configured grouping
    const aggregations = this.aggregateLosses(lossData, groupLabels, config);
    
    // Create datasets for the chart
    const datasets = this.createLossDatasets(aggregations, config);
    
    // Extract labels
    const labels = aggregations.map(agg => agg.label);
    
    const metadata = new ChartMetadata(
      new Date(),
      lossData.length,
      Date.now() - startTime,
      false
    );
    
    return new ChartData(ChartType.LOSSES, labels, datasets, metadata);
  }

  /**
   * Aggregate losses by group
   */
  private aggregateLosses(
    lossData: LossDataPoint[],
    groupLabels: string[],
    _config: ChartConfiguration
  ): LossAggregation[] {
    const aggregations: Map<string, LossAggregation> = new Map();
    
    // Initialize aggregations for each group
    groupLabels.forEach(label => {
      aggregations.set(label, {
        label,
        totalLosses: 0,
        totalValue: BigInt(0),
        highValueLosses: 0,
        averageValue: BigInt(0)
      });
    });
    
    // Process each loss
    lossData.forEach(loss => {
      const groupLabel = this.determineGroupLabel(loss, groupLabels);
      const agg = aggregations.get(groupLabel);
      
      if (agg) {
        agg.totalLosses++;
        agg.totalValue = agg.totalValue + loss.totalValue;
        
        if (loss.totalValue >= this.HIGH_VALUE_THRESHOLD) {
          agg.highValueLosses++;
        }
      }
    });
    
    // Calculate averages
    aggregations.forEach(agg => {
      if (agg.totalLosses > 0) {
        agg.averageValue = agg.totalValue / BigInt(agg.totalLosses);
      }
    });
    
    return Array.from(aggregations.values());
  }

  /**
   * Create chart datasets from aggregations
   */
  private createLossDatasets(
    aggregations: LossAggregation[],
    config: ChartConfiguration
  ): ChartDataset[] {
    const datasets: ChartDataset[] = [];
    
    // Total losses count dataset
    datasets.push(new ChartDataset(
      'Total Losses',
      aggregations.map(agg => agg.totalLosses),
      this.getChartColor('loss'),
      this.getChartColor('lossBorder'),
      2,
      false
    ));
    
    // ISK value dataset (in billions)
    if (config.displayOptions.showIskValue !== false) {
      datasets.push(new ChartDataset(
        'ISK Lost (Billions)',
        aggregations.map(agg => this.convertToIskBillions(agg.totalValue)),
        this.getChartColor('isk'),
        this.getChartColor('iskBorder'),
        2,
        true
      ));
    }
    
    // High value losses dataset
    if (config.displayOptions.showHighValueLosses === true) {
      datasets.push(new ChartDataset(
        'High Value Losses',
        aggregations.map(agg => agg.highValueLosses),
        this.getChartColor('highValue'),
        this.getChartColor('highValueBorder'),
        2,
        false
      ));
    }
    
    return datasets;
  }

  /**
   * Determine which group a loss belongs to
   */
  private determineGroupLabel(loss: LossDataPoint, groupLabels: string[]): string {
    return loss.groupId || groupLabels[0] || 'Unknown';
  }

  /**
   * Convert ISK value to billions for display
   */
  private convertToIskBillions(value: bigint): number {
    return Number(value) / 1_000_000_000;
  }

  /**
   * Get chart colors based on type
   */
  private getChartColor(type: string): string {
    const colorMap: Record<string, string> = {
      loss: '#F44336',
      lossBorder: '#D32F2F',
      isk: '#FF9800',
      iskBorder: '#F57C00',
      highValue: '#9C27B0',
      highValueBorder: '#7B1FA2'
    };
    
    return colorMap[type] || '#9E9E9E';
  }
}