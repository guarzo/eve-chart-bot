/**
 * Chart Data Processing Domain Service
 * Contains pure business logic for processing chart data
 */

import { ChartConfiguration } from '../value-objects/ChartConfiguration';
import { ChartData, ChartDataset } from '../value-objects/ChartData';
// ChartType is imported in the value objects that use it

export class ChartDataProcessor {
  /**
   * Process raw kill data into chart-ready format
   */
  public processKillData(config: ChartConfiguration, killData: KillDataPoint[]): ChartData {
    const timeLabels = this.generateTimeLabels(config);
    const aggregatedData = this.aggregateKillsByTime(killData, timeLabels, config);

    const datasets: ChartDataset[] = [
      new ChartDataset('Total Kills', aggregatedData.totalKills, '#4CAF50', '#388E3C', 2, false),
      new ChartDataset('Solo Kills', aggregatedData.soloKills, '#2196F3', '#1976D2', 2, false),
    ];

    return new ChartData(config.type, timeLabels, datasets);
  }

  /**
   * Process raw loss data into chart-ready format
   */
  public processLossData(config: ChartConfiguration, lossData: LossDataPoint[]): ChartData {
    const timeLabels = this.generateTimeLabels(config);
    const aggregatedData = this.aggregateLossesByTime(lossData, timeLabels, config);

    const datasets: ChartDataset[] = [
      new ChartDataset('Total Losses', aggregatedData.totalLosses, '#F44336', '#D32F2F', 2, false),
      new ChartDataset('ISK Value (Billions)', aggregatedData.iskValues, '#FF9800', '#F57C00', 2, true),
    ];

    return new ChartData(config.type, timeLabels, datasets);
  }

  /**
   * Process efficiency data (kills vs losses ratio)
   */
  public processEfficiencyData(
    config: ChartConfiguration,
    killData: KillDataPoint[],
    lossData: LossDataPoint[]
  ): ChartData {
    const timeLabels = this.generateTimeLabels(config);
    const killsAggregated = this.aggregateKillsByTime(killData, timeLabels, config);
    const lossesAggregated = this.aggregateLossesByTime(lossData, timeLabels, config);

    const efficiencyRatios = killsAggregated.totalKills.map((kills, index) => {
      const losses = lossesAggregated.totalLosses[index] || 0;
      return kills + losses > 0 ? (kills / (kills + losses)) * 100 : 0;
    });

    const datasets: ChartDataset[] = [
      new ChartDataset('Efficiency %', efficiencyRatios, '#9C27B0', '#7B1FA2', 3, true),
    ];

    return new ChartData(config.type, timeLabels, datasets);
  }

  /**
   * Generate time labels based on configuration
   */
  private generateTimeLabels(config: ChartConfiguration): string[] {
    const labels: string[] = [];
    const start = new Date(config.startDate);
    const end = new Date(config.endDate);

    let current = new Date(start);
    const increment = this.getTimeIncrement(config.timePeriod);

    while (current <= end) {
      labels.push(this.formatTimeLabel(current, config.timePeriod));
      current = new Date(current.getTime() + increment);
    }

    return labels;
  }

  /**
   * Get time increment in milliseconds for the given period
   */
  private getTimeIncrement(period: string): number {
    switch (period) {
      case '1h':
        return 60 * 60 * 1000;
      case '1d':
        return 24 * 60 * 60 * 1000;
      case '1w':
        return 7 * 24 * 60 * 60 * 1000;
      case '1m':
        return 30 * 24 * 60 * 60 * 1000;
      case '3m':
        return 90 * 24 * 60 * 60 * 1000;
      case '1y':
        return 365 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Format time labels based on period
   */
  private formatTimeLabel(date: Date, period: string): string {
    switch (period) {
      case '1h':
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      case '1d':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case '1w':
      case '1m':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case '3m':
      case '1y':
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      default:
        return date.toLocaleDateString('en-US');
    }
  }

  /**
   * Aggregate kills by time periods
   */
  private aggregateKillsByTime(
    killData: KillDataPoint[],
    timeLabels: string[],
    config: ChartConfiguration
  ): { totalKills: number[]; soloKills: number[] } {
    const totalKills: number[] = new Array(timeLabels.length).fill(0);
    const soloKills: number[] = new Array(timeLabels.length).fill(0);

    killData.forEach(kill => {
      const labelIndex = this.findTimeSlotIndex(kill.killTime, timeLabels, config);
      if (labelIndex >= 0) {
        totalKills[labelIndex]++;
        if (kill.solo) {
          soloKills[labelIndex]++;
        }
      }
    });

    return { totalKills, soloKills };
  }

  /**
   * Aggregate losses by time periods
   */
  private aggregateLossesByTime(
    lossData: LossDataPoint[],
    timeLabels: string[],
    config: ChartConfiguration
  ): { totalLosses: number[]; iskValues: number[] } {
    const totalLosses: number[] = new Array(timeLabels.length).fill(0);
    const iskValues: number[] = new Array(timeLabels.length).fill(0);

    lossData.forEach(loss => {
      const labelIndex = this.findTimeSlotIndex(loss.killTime, timeLabels, config);
      if (labelIndex >= 0) {
        totalLosses[labelIndex]++;
        iskValues[labelIndex] += Number(loss.totalValue) / 1_000_000_000; // Convert to billions
      }
    });

    return { totalLosses, iskValues };
  }

  /**
   * Find the appropriate time slot index for a given timestamp
   */
  private findTimeSlotIndex(timestamp: Date, timeLabels: string[], config: ChartConfiguration): number {
    const increment = this.getTimeIncrement(config.timePeriod);
    const startTime = config.startDate.getTime();
    const eventTime = timestamp.getTime();

    const slotIndex = Math.floor((eventTime - startTime) / increment);
    return slotIndex >= 0 && slotIndex < timeLabels.length ? slotIndex : -1;
  }
}

// Data interfaces used by the domain service
export interface KillDataPoint {
  killTime: Date;
  killmailId: bigint;
  characterId: bigint;
  solo: boolean;
  npc: boolean;
}

export interface LossDataPoint {
  killTime: Date;
  killmailId: bigint;
  characterId: bigint;
  totalValue: bigint;
  shipTypeId: number;
  systemId: number;
}
