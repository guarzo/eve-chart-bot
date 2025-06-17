import { ChartData } from '../value-objects/ChartData';
import { ChartConfiguration } from '../value-objects/ChartConfiguration';

/**
 * Interface for chart data processors
 * Defines contract for processing raw data into chart-ready format
 */
export interface IChartDataProcessor {
  /**
   * Process raw data based on configuration
   * @param config Chart configuration
   * @param rawData Raw data to process
   */
  processData(config: ChartConfiguration, rawData: any[]): Promise<ChartData>;

  /**
   * Validate configuration for this processor
   * @param config Chart configuration to validate
   */
  validateConfiguration(config: ChartConfiguration): boolean;
}
