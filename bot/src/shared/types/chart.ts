/**
 * Shared chart-related type definitions
 * Extracted from inline types used across chart generators
 */

/**
 * Chart time period options
 */
export type ChartTimePeriod = '7d' | '30d' | '90d' | '1y' | 'all';

/**
 * Chart aggregation interval
 */
export type ChartInterval = 'hour' | 'day' | 'week' | 'month';

/**
 * Ship data entry for ship-related charts
 */
export interface ShipDataEntry {
  shipName: string;
  count: number;
  value?: bigint;
  percentage?: number;
}

/**
 * Time-series data point
 */
export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

/**
 * Kill data for chart generation
 */
export interface KillChartData {
  killmailId: bigint;
  killTime: Date;
  victim?: { characterId?: bigint };
  attackers?: Array<{ characterId?: bigint }>;
  solo: boolean;
  shipTypeId: number;
  systemId: number;
  totalValue: bigint;
}

/**
 * Loss data for chart generation
 */
export interface LossChartData {
  killmailId: bigint;
  killTime: Date;
  characterId: bigint;
  shipTypeId: number;
  systemId: number;
  totalValue: bigint;
  attackerCount: number;
}

/**
 * Efficiency calculation data
 */
export interface EfficiencyData {
  killCount: number;
  lossCount: number;
  iskDestroyed: bigint;
  iskLost: bigint;
  efficiency: number;
}

/**
 * Chart display configuration
 */
export interface ChartDisplayConfig {
  title: string;
  width: number;
  height: number;
  backgroundColor?: string;
  showLegend?: boolean;
  showTooltips?: boolean;
}

/**
 * Chart data aggregation options
 */
export interface ChartAggregationOptions {
  period: ChartTimePeriod;
  interval: ChartInterval;
  groupBy?: string;
  limit?: number;
}

/**
 * Chart filter options
 */
export interface ChartFilterOptions {
  characterIds?: bigint[];
  shipTypeIds?: number[];
  systemIds?: number[];
  startDate?: Date;
  endDate?: Date;
  minValue?: bigint;
  maxValue?: bigint;
}

/**
 * Chart generation parameters
 */
export interface ChartGenerationParams {
  type: string;
  config: ChartDisplayConfig;
  aggregation: ChartAggregationOptions;
  filters: ChartFilterOptions;
}
