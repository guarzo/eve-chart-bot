import { ChartData, ChartMetadata } from '../../value-objects/ChartData';
import { ChartConfiguration } from '../../value-objects/ChartConfiguration';
import { IChartDataProcessor } from '../IChartDataProcessor';
import { ChartType } from '../../../../../shared/types/common';

/**
 * Domain service for processing ratio chart data
 * Contains pure business logic for kill/loss ratio analysis
 */
export class RatioDataProcessor implements IChartDataProcessor {
  private createMetadata(dataLength: number): ChartMetadata {
    return new ChartMetadata(new Date(), dataLength, 0, false);
  }

  /**
   * Process ratio data based on configuration
   */
  async processData(config: ChartConfiguration, rawData: any[]): Promise<ChartData> {
    // Group data by entity (character groups)
    const ratioData = this.calculateRatiosByGroup(rawData);

    return this.formatRatioData(ratioData, config);
  }

  /**
   * Calculate kill/loss ratios by character group
   */
  private calculateRatiosByGroup(rawData: any[]): Array<{
    groupName: string;
    kills: number;
    losses: number;
    ratio: number;
    efficiency: number;
    totalValue: number;
  }> {
    const groupStats = new Map<
      string,
      {
        kills: number;
        losses: number;
        killValue: number;
        lossValue: number;
      }
    >();

    // Process each data point
    rawData.forEach(dataPoint => {
      const groupName = dataPoint.groupName || 'Unknown';

      if (!groupStats.has(groupName)) {
        groupStats.set(groupName, {
          kills: 0,
          losses: 0,
          killValue: 0,
          lossValue: 0,
        });
      }

      const stats = groupStats.get(groupName)!;

      // Determine if this is a kill or loss
      if (dataPoint.type === 'kill' || dataPoint.isKill) {
        stats.kills++;
        stats.killValue += Number(dataPoint.totalValue || 0);
      } else if (dataPoint.type === 'loss' || dataPoint.isLoss) {
        stats.losses++;
        stats.lossValue += Number(dataPoint.totalValue || 0);
      }
    });

    // Convert to ratio data
    const ratioData: Array<{
      groupName: string;
      kills: number;
      losses: number;
      ratio: number;
      efficiency: number;
      totalValue: number;
    }> = [];

    groupStats.forEach((stats, groupName) => {
      const ratio = stats.losses > 0 ? stats.kills / stats.losses : stats.kills;
      const totalValue = stats.killValue + stats.lossValue;
      const efficiency = totalValue > 0 ? (stats.killValue / totalValue) * 100 : 0;

      ratioData.push({
        groupName,
        kills: stats.kills,
        losses: stats.losses,
        ratio: Math.round(ratio * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        totalValue,
      });
    });

    // Sort by ratio descending
    return ratioData.sort((a, b) => b.ratio - a.ratio);
  }

  /**
   * Format ratio data for chart display
   */
  private formatRatioData(
    ratioData: Array<{
      groupName: string;
      kills: number;
      losses: number;
      ratio: number;
      efficiency: number;
      totalValue: number;
    }>,
    config: ChartConfiguration
  ): ChartData {
    const labels = ratioData.map(data => data.groupName);

    // Create datasets based on display options
    const datasets = [];

    // Always include ratio
    datasets.push({
      label: 'Kill/Loss Ratio',
      data: ratioData.map(data => data.ratio),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1,
      yAxisID: 'y',
    });

    // Optionally include efficiency
    if (config.displayOptions?.showEfficiency !== false) {
      datasets.push({
        label: 'Efficiency %',
        data: ratioData.map(data => data.efficiency),
        backgroundColor: 'rgba(255, 159, 64, 0.6)',
        borderColor: 'rgba(255, 159, 64, 1)',
        borderWidth: 1,
        yAxisID: 'y1',
      });
    }

    return new ChartData(ChartType.RATIO, labels, datasets, this.createMetadata(ratioData.length));
  }

  /**
   * Validate ratio configuration
   */
  validateConfiguration(config: ChartConfiguration): boolean {
    if (!config.startDate || !config.endDate) {
      return false;
    }

    if (config.endDate <= config.startDate) {
      return false;
    }

    // Ratio charts need both kill and loss data
    if (!config.characterIds || config.characterIds.length === 0) {
      return false;
    }

    return true;
  }
}
