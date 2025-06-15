import { ChartData, ChartOptions } from './ChartService';
import { ChartPipeline, ChartGenerationConfig } from './pipeline/ChartPipeline';
import { ChartPipelineFactory, ChartPipelineConfig } from './factories/ChartPipelineFactory';
import { ValidatedConfiguration as Configuration } from '../../config/validated';
import { logger } from '../../lib/logger';

/**
 * Simplified chart service using clean pipeline architecture
 * Eliminates complex nested feature flag logic
 */
export class SimplifiedChartService {
  private readonly pipeline: ChartPipeline;

  constructor(config?: ChartPipelineConfig) {
    // Create pipeline with clean configuration instead of feature flags
    this.pipeline = config 
      ? ChartPipelineFactory.createShipUsagePipeline(config)
      : ChartPipelineFactory.createFromEnvironment();

    logger.info('SimplifiedChartService: Initialized with clean pipeline');
  }

  /**
   * Generate ship usage chart data
   */
  async generateShipUsageData(
    characterId?: string, 
    groupId?: string, 
    days: number = 30
  ): Promise<ChartData | null> {
    try {
      logger.info('SimplifiedChartService: Generating ship usage data', {
        characterId,
        groupId,
        days,
      });

      const config: ChartGenerationConfig = {
        characterId,
        groupId,
        days,
        chartType: 'ship-usage',
        cacheEnabled: true,
        cacheTTL: Configuration.charts.defaultCacheTTLSeconds,
      };

      return await this.pipeline.generateData(config);
    } catch (error) {
      logger.error('SimplifiedChartService: Failed to generate ship usage data', error);
      return null;
    }
  }

  /**
   * Generate ship usage chart as PNG buffer
   */
  async generateShipUsageChart(
    characterId?: string,
    groupId?: string,
    days: number = 30,
    options?: Partial<ChartOptions>
  ): Promise<Buffer | null> {
    try {
      logger.info('SimplifiedChartService: Generating ship usage chart', {
        characterId,
        groupId,
        days,
        options,
      });

      const config: ChartGenerationConfig = {
        characterId,
        groupId,
        days,
        chartType: 'ship-usage',
        cacheEnabled: true,
        cacheTTL: Configuration.charts.defaultCacheTTLSeconds,
      };

      // Clean two-step pipeline: generate data then render
      return await this.pipeline.generateAndRenderPNG(config, options);
    } catch (error) {
      logger.error('SimplifiedChartService: Failed to generate ship usage chart', error);
      return null;
    }
  }

  /**
   * Generate ship usage chart as HTML
   */
  async generateShipUsageHTML(
    characterId?: string,
    groupId?: string,
    days: number = 30,
    options?: Partial<ChartOptions>
  ): Promise<string | null> {
    try {
      logger.info('SimplifiedChartService: Generating ship usage HTML', {
        characterId,
        groupId,
        days,
        options,
      });

      const config: ChartGenerationConfig = {
        characterId,
        groupId,
        days,
        chartType: 'ship-usage',
        cacheEnabled: true,
        cacheTTL: Configuration.charts.defaultCacheTTLSeconds,
      };

      // Clean two-step pipeline: generate data then render
      return await this.pipeline.generateAndRenderHTML(config, options);
    } catch (error) {
      logger.error('SimplifiedChartService: Failed to generate ship usage HTML', error);
      return null;
    }
  }

  /**
   * Render existing chart data as PNG
   */
  async renderChartAsPNG(chartData: ChartData, options?: Partial<ChartOptions>): Promise<Buffer | null> {
    try {
      logger.info('SimplifiedChartService: Rendering chart as PNG', {
        labelsCount: chartData.labels.length,
        datasetsCount: chartData.datasets.length,
        options,
      });

      return await this.pipeline.renderPNG(chartData, options);
    } catch (error) {
      logger.error('SimplifiedChartService: Failed to render chart as PNG', error);
      return null;
    }
  }

  /**
   * Render existing chart data as HTML
   */
  async renderChartAsHTML(chartData: ChartData, options?: Partial<ChartOptions>): Promise<string> {
    try {
      logger.info('SimplifiedChartService: Rendering chart as HTML', {
        labelsCount: chartData.labels.length,
        datasetsCount: chartData.datasets.length,
        options,
      });

      return await this.pipeline.renderHTML(chartData, options);
    } catch (error) {
      logger.error('SimplifiedChartService: Failed to render chart as HTML', error);
      return '<html><body><h1>Error rendering chart</h1></body></html>';
    }
  }

  /**
   * Get default chart options
   */
  getDefaultOptions(): ChartOptions {
    return {
      width: Configuration.charts.defaultWidth,
      height: Configuration.charts.defaultHeight,
      showLegend: true,
      showLabels: true,
      lightMode: false,
    };
  }
}