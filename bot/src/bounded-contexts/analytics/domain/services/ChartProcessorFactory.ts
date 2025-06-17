import { IChartDataProcessor } from './IChartDataProcessor';
import { ChartConfiguration } from '../value-objects/ChartConfiguration';
import { KillsDataProcessor } from './processors/KillsDataProcessor';
import { LossDataProcessor } from './processors/LossDataProcessor';
import { EfficiencyDataProcessor } from './processors/EfficiencyDataProcessor';
import { HeatmapDataProcessor } from './processors/HeatmapDataProcessor';
import { ShipTypesDataProcessor } from './processors/ShipTypesDataProcessor';
import { TrendDataProcessor } from './processors/TrendDataProcessor';
import { RatioDataProcessor } from './processors/RatioDataProcessor';
import { DistributionDataProcessor } from './processors/DistributionDataProcessor';
import { CorpsDataProcessor } from './processors/CorpsDataProcessor';

/**
 * Factory for creating appropriate chart data processors
 * Provides processor instances based on chart configuration
 */
export class ChartProcessorFactory {
  private static readonly processors = new Map<string, () => IChartDataProcessor>([
    ['kills', () => new KillsDataProcessor()],
    ['losses', () => new LossDataProcessor()],
    ['efficiency', () => new EfficiencyDataProcessor()],
    ['heatmap', () => new HeatmapDataProcessor()],
    ['activity-heatmap', () => new HeatmapDataProcessor()],
    ['calendar-heatmap', () => new HeatmapDataProcessor()],
    ['ship-types', () => new ShipTypesDataProcessor()],
    ['ship-types-used', () => new ShipTypesDataProcessor()],
    ['ship-types-destroyed', () => new ShipTypesDataProcessor()],
    ['trend', () => new TrendDataProcessor()],
    ['trends', () => new TrendDataProcessor()],
    ['ratio', () => new RatioDataProcessor()],
    ['ratios', () => new RatioDataProcessor()],
    ['kill-loss-ratio', () => new RatioDataProcessor()],
    ['distribution', () => new DistributionDataProcessor()],
    ['system-distribution', () => new DistributionDataProcessor()],
    ['region-distribution', () => new DistributionDataProcessor()],
    ['corps', () => new CorpsDataProcessor()],
    ['corporations', () => new CorpsDataProcessor()],
    ['corp-activity', () => new CorpsDataProcessor()],
    ['corp-kills', () => new CorpsDataProcessor()],
    ['corp-losses', () => new CorpsDataProcessor()],
    ['corp-efficiency', () => new CorpsDataProcessor()],
    ['enemy-corps', () => new CorpsDataProcessor()],
  ]);

  /**
   * Create processor for the given chart configuration
   */
  public static createProcessor(config: ChartConfiguration): IChartDataProcessor {
    const chartType = this.normalizeChartType(config.type);
    const processorFactory = this.processors.get(chartType);

    if (!processorFactory) {
      throw new Error(`No processor found for chart type: ${config.type}`);
    }

    return processorFactory();
  }

  /**
   * Get processor for a specific chart type string
   */
  public static getProcessor(chartType: string): IChartDataProcessor {
    const normalizedType = this.normalizeChartType(chartType);
    const processorFactory = this.processors.get(normalizedType);

    if (!processorFactory) {
      throw new Error(`No processor found for chart type: ${chartType}`);
    }

    return processorFactory();
  }

  /**
   * Check if a processor exists for the given chart type
   */
  public static hasProcessor(chartType: string): boolean {
    const normalizedType = this.normalizeChartType(chartType);
    return this.processors.has(normalizedType);
  }

  /**
   * Get all supported chart types
   */
  public static getSupportedTypes(): string[] {
    return Array.from(this.processors.keys()).sort();
  }

  /**
   * Register a new processor type
   */
  public static registerProcessor(chartType: string, processorFactory: () => IChartDataProcessor): void {
    const normalizedType = this.normalizeChartType(chartType);
    this.processors.set(normalizedType, processorFactory);
  }

  /**
   * Normalize chart type string for consistent lookup
   */
  private static normalizeChartType(chartType: string): string {
    return chartType.toLowerCase().trim();
  }

  /**
   * Get processor with validation
   */
  public static createValidatedProcessor(config: ChartConfiguration): IChartDataProcessor {
    const processor = this.createProcessor(config);

    if (!processor.validateConfiguration(config)) {
      throw new Error(`Invalid configuration for chart type: ${config.type}`);
    }

    return processor;
  }

  /**
   * Get processor type mapping for legacy compatibility
   */
  public static getLegacyTypeMapping(): Map<string, string> {
    return new Map([
      // Legacy chart service types -> new processor types
      ['kills', 'kills'],
      ['kill', 'kills'],
      ['losses', 'losses'],
      ['loss', 'losses'],
      ['efficiency', 'efficiency'],
      ['eff', 'efficiency'],
      ['heatmap', 'heatmap'],
      ['heat', 'heatmap'],
      ['activity', 'heatmap'],
      ['ships', 'ship-types'],
      ['ship-types', 'ship-types'],
      ['ship', 'ship-types'],
      ['trend', 'trend'],
      ['trends', 'trend'],
      ['time', 'trend'],
      ['ratio', 'ratio'],
      ['ratios', 'ratio'],
      ['kl-ratio', 'ratio'],
      ['distribution', 'distribution'],
      ['dist', 'distribution'],
      ['systems', 'system-distribution'],
      ['regions', 'region-distribution'],
      ['corps', 'corps'],
      ['corp', 'corps'],
      ['corporations', 'corps'],
      ['enemies', 'enemy-corps'],
    ]);
  }

  /**
   * Map legacy chart type to new processor type
   */
  public static mapLegacyType(legacyType: string): string {
    const mapping = this.getLegacyTypeMapping();
    const normalizedLegacy = this.normalizeChartType(legacyType);

    return mapping.get(normalizedLegacy) || normalizedLegacy;
  }
}
