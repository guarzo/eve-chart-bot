import { ChartData, ChartOptions } from '../ChartService';
import { logger } from '../../../lib/logger';

/**
 * Chart generation configuration
 */
export interface ChartGenerationConfig {
  characterId?: string;
  groupId?: string;
  days?: number;
  chartType?: string;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

/**
 * Chart data provider interface
 * Separates data generation from rendering concerns
 */
export interface IChartDataProvider {
  generateChartData(config: ChartGenerationConfig): Promise<ChartData | null>;
}

/**
 * Chart renderer interface
 * Handles only rendering concerns
 */
export interface IChartRenderer {
  renderPNG(chartData: ChartData, options?: Partial<ChartOptions>): Promise<Buffer | null>;
  renderHTML(chartData: ChartData, options?: Partial<ChartOptions>): Promise<string>;
}

/**
 * Clean two-step chart generation pipeline
 * Step 1: Generate data via provider
 * Step 2: Render via renderer
 */
export class ChartPipeline {
  constructor(
    private readonly dataProvider: IChartDataProvider,
    private readonly renderer: IChartRenderer
  ) {}

  /**
   * Generate chart data
   */
  async generateData(config: ChartGenerationConfig): Promise<ChartData | null> {
    try {
      logger.info('Chart pipeline: Generating data', {
        characterId: config.characterId,
        groupId: config.groupId,
        days: config.days,
        chartType: config.chartType,
      });

      const chartData = await this.dataProvider.generateChartData(config);
      
      if (!chartData) {
        logger.warn('Chart pipeline: No data generated');
        return null;
      }

      logger.info('Chart pipeline: Data generation completed', {
        labelsCount: chartData.labels.length,
        datasetsCount: chartData.datasets.length,
      });

      return chartData;
    } catch (error) {
      logger.error('Chart pipeline: Data generation failed', error);
      throw error;
    }
  }

  /**
   * Render chart as PNG
   */
  async renderPNG(chartData: ChartData, options?: Partial<ChartOptions>): Promise<Buffer | null> {
    try {
      logger.info('Chart pipeline: Rendering PNG', {
        width: options?.width,
        height: options?.height,
        title: options?.title,
      });

      const buffer = await this.renderer.renderPNG(chartData, options);
      
      if (!buffer) {
        logger.warn('Chart pipeline: PNG rendering returned null');
        return null;
      }

      logger.info('Chart pipeline: PNG rendering completed', {
        bufferSize: buffer.length,
      });

      return buffer;
    } catch (error) {
      logger.error('Chart pipeline: PNG rendering failed', error);
      throw error;
    }
  }

  /**
   * Render chart as HTML
   */
  async renderHTML(chartData: ChartData, options?: Partial<ChartOptions>): Promise<string> {
    try {
      logger.info('Chart pipeline: Rendering HTML', {
        title: options?.title,
        showLegend: options?.showLegend,
      });

      const html = await this.renderer.renderHTML(chartData, options);
      
      logger.info('Chart pipeline: HTML rendering completed', {
        htmlLength: html.length,
      });

      return html;
    } catch (error) {
      logger.error('Chart pipeline: HTML rendering failed', error);
      throw error;
    }
  }

  /**
   * Complete pipeline: generate data and render as PNG
   */
  async generateAndRenderPNG(
    config: ChartGenerationConfig, 
    options?: Partial<ChartOptions>
  ): Promise<Buffer | null> {
    const chartData = await this.generateData(config);
    if (!chartData) {
      return null;
    }
    return await this.renderPNG(chartData, options);
  }

  /**
   * Complete pipeline: generate data and render as HTML
   */
  async generateAndRenderHTML(
    config: ChartGenerationConfig, 
    options?: Partial<ChartOptions>
  ): Promise<string | null> {
    const chartData = await this.generateData(config);
    if (!chartData) {
      return null;
    }
    return await this.renderHTML(chartData, options);
  }
}