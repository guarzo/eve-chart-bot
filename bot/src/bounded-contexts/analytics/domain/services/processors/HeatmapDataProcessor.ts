import { ChartData, ChartMetadata } from '../../value-objects/ChartData';
import { ChartConfiguration } from '../../value-objects/ChartConfiguration';
import { IChartDataProcessor } from '../IChartDataProcessor';
import { ChartType } from '../../../../../shared/types/common';
import { format } from 'date-fns';

/**
 * Domain service for processing heatmap chart data
 * Contains pure business logic for activity time analysis
 */
export class HeatmapDataProcessor implements IChartDataProcessor {
  /**
   * Create basic chart metadata
   */
  private createMetadata(dataLength: number): ChartMetadata {
    return new ChartMetadata(new Date(), dataLength, 0, false);
  }

  /**
   * Process heatmap data based on configuration
   */
  async processData(config: ChartConfiguration, rawData: any[]): Promise<ChartData> {
    // Determine heatmap type
    if (config.displayOptions?.heatmapType === 'calendar') {
      return this.processCalendarHeatmapData(rawData, config);
    } else {
      return this.processTimeOfDayHeatmapData(rawData, config);
    }
  }

  /**
   * Process time-of-day heatmap data
   */
  private processTimeOfDayHeatmapData(rawData: any[], _config: ChartConfiguration): ChartData {
    const hourlyData = new Map<number, number>();

    // Initialize hours 0-23
    for (let hour = 0; hour < 24; hour++) {
      hourlyData.set(hour, 0);
    }

    // Process raw kill data
    rawData.forEach(kill => {
      const killTime = new Date(kill.killTime);
      const hour = killTime.getUTCHours();
      const currentCount = hourlyData.get(hour) || 0;
      hourlyData.set(hour, currentCount + 1);
    });

    // Convert to chart data format
    const labels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    const data = Array.from({ length: 24 }, (_, i) => hourlyData.get(i) || 0);

    return new ChartData(
      ChartType.TIME_OF_DAY_HEATMAP,
      labels,
      [
        {
          label: 'Activity Count',
          data,
          backgroundColor: this.generateHeatmapColors(data),
          borderWidth: 1,
        },
      ],
      this.createMetadata(rawData.length)
    );
  }

  /**
   * Process calendar heatmap data
   */
  private processCalendarHeatmapData(rawData: any[], _config: ChartConfiguration): ChartData {
    const dailyData = new Map<string, number>();

    // Initialize date range
    const currentDate = new Date(_config.startDate);
    const endDate = new Date(_config.endDate);

    while (currentDate <= endDate) {
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      dailyData.set(dateKey, 0);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process raw kill data
    rawData.forEach(kill => {
      const killDate = format(new Date(kill.killTime), 'yyyy-MM-dd');
      if (dailyData.has(killDate)) {
        const currentCount = dailyData.get(killDate) || 0;
        dailyData.set(killDate, currentCount + 1);
      }
    });

    // Convert to chart data format
    const labels = Array.from(dailyData.keys()).sort();
    const data = labels.map(date => dailyData.get(date) || 0);

    return new ChartData(
      ChartType.CALENDAR_HEATMAP,
      labels,
      [
        {
          label: 'Daily Activity',
          data,
          backgroundColor: this.generateHeatmapColors(data),
          borderWidth: 1,
        },
      ],
      this.createMetadata(rawData.length)
    );
  }

  /**
   * Generate color gradient for heatmap based on values
   */
  private generateHeatmapColors(values: number[]): string[] {
    const maxValue = Math.max(...values);
    if (maxValue === 0) {
      return values.map(() => 'rgba(200, 200, 200, 0.3)');
    }

    return values.map(value => {
      const intensity = value / maxValue;
      const alpha = Math.max(0.1, intensity);
      return `rgba(255, 99, 132, ${alpha})`;
    });
  }

  /**
   * Validate heatmap-specific configuration
   */
  validateConfiguration(config: ChartConfiguration): boolean {
    if (!config.startDate || !config.endDate) {
      return false;
    }

    if (config.endDate <= config.startDate) {
      return false;
    }

    // Validate date range is reasonable for heatmap
    const daysDiff = Math.ceil((config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24));

    // For calendar heatmap, limit to reasonable range
    if (config.displayOptions?.heatmapType === 'calendar' && daysDiff > 365) {
      return false;
    }

    return true;
  }
}
