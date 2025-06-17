import { ChartData, ChartOptions } from '../ChartService';
import { IChartRenderer } from '../pipeline/ChartPipeline';
import { IChartRenderStrategy } from '../strategies/IChartRenderStrategy';
import { logger } from '../../../lib/logger';

/**
 * Chart renderer that uses strategy pattern without feature flag coupling
 * Delegates to injected strategy for clean separation of concerns
 */
export class StrategyChartRenderer implements IChartRenderer {
  constructor(private readonly strategy: IChartRenderStrategy) {}

  /**
   * Render chart as PNG using the configured strategy
   */
  async renderPNG(chartData: ChartData, options?: Partial<ChartOptions>): Promise<Buffer | null> {
    try {
      logger.info('StrategyChartRenderer: Rendering PNG', {
        strategy: this.strategy.constructor.name,
        labelsCount: chartData.labels.length,
        datasetsCount: chartData.datasets.length,
      });

      const buffer = await this.strategy.renderPNG(chartData, options);

      if (buffer) {
        logger.info('StrategyChartRenderer: PNG rendering successful', {
          bufferSize: buffer.length,
        });
      } else {
        logger.warn('StrategyChartRenderer: PNG rendering returned null');
      }

      return buffer;
    } catch (error) {
      logger.error('StrategyChartRenderer: PNG rendering failed', {
        strategy: this.strategy.constructor.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Render chart as HTML using the configured strategy
   */
  async renderHTML(chartData: ChartData, options?: Partial<ChartOptions>): Promise<string> {
    try {
      logger.info('StrategyChartRenderer: Rendering HTML', {
        strategy: this.strategy.constructor.name,
        labelsCount: chartData.labels.length,
        datasetsCount: chartData.datasets.length,
      });

      const html = await this.strategy.renderHTML(chartData, options);

      logger.info('StrategyChartRenderer: HTML rendering successful', {
        htmlLength: html.length,
      });

      return html;
    } catch (error) {
      logger.error('StrategyChartRenderer: HTML rendering failed', {
        strategy: this.strategy.constructor.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get the name of the current strategy (for debugging)
   */
  getStrategyName(): string {
    return this.strategy.constructor.name;
  }
}
