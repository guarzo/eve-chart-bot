import { ChartData, ChartMetadata } from '../../value-objects/ChartData';
import { ChartConfiguration } from '../../value-objects/ChartConfiguration';
import { IChartDataProcessor } from '../IChartDataProcessor';
import { ChartType } from '../../../../../shared/types/common';
import { format, startOfDay, addDays, addHours, addWeeks } from 'date-fns';

/**
 * Domain service for processing trend chart data
 * Contains pure business logic for temporal trend analysis
 */
export class TrendDataProcessor implements IChartDataProcessor {
  private createMetadata(dataLength: number): ChartMetadata {
    return new ChartMetadata(new Date(), dataLength, 0, false);
  }

  /**
   * Process trend data based on configuration
   */
  async processData(config: ChartConfiguration, rawData: any[]): Promise<ChartData> {
    const granularity = config.displayOptions?.granularity || 'day';

    switch (granularity) {
      case 'hour':
        return this.processHourlyTrend(rawData, config);
      case 'week':
        return this.processWeeklyTrend(rawData, config);
      case 'day':
      default:
        return this.processDailyTrend(rawData, config);
    }
  }

  /**
   * Process hourly trend data
   */
  private processHourlyTrend(rawData: any[], config: ChartConfiguration): ChartData {
    const timeSlots = this.generateHourlyTimeSlots(config.startDate, config.endDate);
    const trendData = this.aggregateDataByTimeSlots(rawData, timeSlots, 'hour');

    return this.formatTrendData(trendData, config, 'Hourly Activity Trend', 'HH:mm');
  }

  /**
   * Process daily trend data
   */
  private processDailyTrend(rawData: any[], config: ChartConfiguration): ChartData {
    const timeSlots = this.generateDailyTimeSlots(config.startDate, config.endDate);
    const trendData = this.aggregateDataByTimeSlots(rawData, timeSlots, 'day');

    return this.formatTrendData(trendData, config, 'Daily Activity Trend', 'MMM dd');
  }

  /**
   * Process weekly trend data
   */
  private processWeeklyTrend(rawData: any[], config: ChartConfiguration): ChartData {
    const timeSlots = this.generateWeeklyTimeSlots(config.startDate, config.endDate);
    const trendData = this.aggregateDataByTimeSlots(rawData, timeSlots, 'week');

    return this.formatTrendData(trendData, config, 'Weekly Activity Trend', 'MMM dd');
  }

  /**
   * Generate hourly time slots
   */
  private generateHourlyTimeSlots(startDate: Date, endDate: Date): Date[] {
    const slots: Date[] = [];
    let current = startOfDay(startDate);

    while (current <= endDate) {
      slots.push(new Date(current));
      current = addHours(current, 1);
    }

    return slots;
  }

  /**
   * Generate daily time slots
   */
  private generateDailyTimeSlots(startDate: Date, endDate: Date): Date[] {
    const slots: Date[] = [];
    let current = startOfDay(startDate);

    while (current <= endDate) {
      slots.push(new Date(current));
      current = addDays(current, 1);
    }

    return slots;
  }

  /**
   * Generate weekly time slots
   */
  private generateWeeklyTimeSlots(startDate: Date, endDate: Date): Date[] {
    const slots: Date[] = [];
    let current = startOfDay(startDate);

    while (current <= endDate) {
      slots.push(new Date(current));
      current = addWeeks(current, 1);
    }

    return slots;
  }

  /**
   * Aggregate raw data by time slots
   */
  private aggregateDataByTimeSlots(
    rawData: any[],
    timeSlots: Date[],
    granularity: 'hour' | 'day' | 'week'
  ): Array<{ time: Date; count: number; value?: number }> {
    const aggregated = timeSlots.map(slot => ({
      time: slot,
      count: 0,
      value: 0,
    }));

    // Group data by time slot
    rawData.forEach(dataPoint => {
      const dataTime = new Date(dataPoint.killTime || dataPoint.timestamp);
      const slotIndex = this.findTimeSlotIndex(dataTime, timeSlots, granularity);

      if (slotIndex >= 0) {
        aggregated[slotIndex].count++;
        if (dataPoint.totalValue) {
          aggregated[slotIndex].value += Number(dataPoint.totalValue);
        }
      }
    });

    return aggregated;
  }

  /**
   * Find the appropriate time slot index for a given time
   */
  private findTimeSlotIndex(dataTime: Date, timeSlots: Date[], granularity: 'hour' | 'day' | 'week'): number {
    for (let i = 0; i < timeSlots.length - 1; i++) {
      const slotStart = timeSlots[i];
      const slotEnd =
        granularity === 'hour'
          ? addHours(slotStart, 1)
          : granularity === 'week'
            ? addWeeks(slotStart, 1)
            : addDays(slotStart, 1);

      if (dataTime >= slotStart && dataTime < slotEnd) {
        return i;
      }
    }

    // Check if it falls in the last slot
    const lastIndex = timeSlots.length - 1;
    if (lastIndex >= 0) {
      const lastSlotStart = timeSlots[lastIndex];
      const lastSlotEnd =
        granularity === 'hour'
          ? addHours(lastSlotStart, 1)
          : granularity === 'week'
            ? addWeeks(lastSlotStart, 1)
            : addDays(lastSlotStart, 1);

      if (dataTime >= lastSlotStart && dataTime <= lastSlotEnd) {
        return lastIndex;
      }
    }

    return -1;
  }

  /**
   * Format trend data for chart display
   */
  private formatTrendData(
    trendData: Array<{ time: Date; count: number; value?: number }>,
    _config: ChartConfiguration,
    _title: string,
    dateFormat: string
  ): ChartData {
    const labels = trendData.map(point => format(point.time, dateFormat));
    const counts = trendData.map(point => point.count);
    const values = trendData.map(point => point.value || 0);

    const datasets = [
      {
        label: 'Activity Count',
        data: counts,
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        fill: false,
      },
    ];

    // Add value dataset if we have meaningful values
    const hasValues = values.some(v => v > 0);
    if (hasValues) {
      datasets.push({
        label: 'Total Value (ISK)',
        data: values,
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 2,
        fill: false,
      });
    }

    return new ChartData(ChartType.TREND, labels, datasets, this.createMetadata(trendData.length));
  }

  /**
   * Validate trend configuration
   */
  validateConfiguration(config: ChartConfiguration): boolean {
    if (!config.startDate || !config.endDate) {
      return false;
    }

    if (config.endDate <= config.startDate) {
      return false;
    }

    // Validate granularity makes sense for date range
    const granularity = config.displayOptions?.granularity || 'day';
    const daysDiff = Math.ceil((config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Reasonable limits for different granularities
    if (granularity === 'hour' && daysDiff > 7) {
      return false; // Max 7 days for hourly
    }

    if (granularity === 'day' && daysDiff > 365) {
      return false; // Max 1 year for daily
    }

    return true;
  }
}
