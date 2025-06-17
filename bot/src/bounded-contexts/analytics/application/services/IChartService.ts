/**
 * Unified Chart Service Interface
 * Central contract for all chart generation operations
 */

import { ChartConfiguration } from '../../domain/value-objects/ChartConfiguration';
import { ChartData } from '../../domain/value-objects/ChartData';
import { OperationResult } from '../../../../shared/types/common';

export interface IChartService {
  /**
   * Generate a chart image buffer based on configuration
   */
  generateChart(config: ChartConfiguration): Promise<OperationResult<Buffer>>;

  /**
   * Generate chart data without rendering (for API consumption)
   */
  generateChartData(config: ChartConfiguration): Promise<OperationResult<ChartData>>;

  /**
   * Get a cached chart if available
   */
  getCachedChart(key: string): Promise<Buffer | null>;

  /**
   * Invalidate cache for specific patterns
   */
  invalidateCache(pattern: string): Promise<void>;

  /**
   * Get supported chart types
   */
  getSupportedChartTypes(): string[];

  /**
   * Validate chart configuration
   */
  validateConfiguration(config: ChartConfiguration): Promise<boolean>;
}

export interface IChartRenderer {
  /**
   * Render chart data to image buffer
   */
  render(data: ChartData, config: ChartConfiguration): Promise<Buffer>;

  /**
   * Get supported output formats
   */
  getSupportedFormats(): string[];
}

export interface IChartDataProcessor {
  /**
   * Process raw data into chart-ready format
   */
  process(config: ChartConfiguration, rawData: any): Promise<ChartData>;

  /**
   * Check if processor supports the chart type
   */
  supports(chartType: string): boolean;
}
