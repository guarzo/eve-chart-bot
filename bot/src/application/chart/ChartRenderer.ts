import { ChartData, ChartOptions } from "./ChartService";
import { logger } from "../../lib/logger";
import { flags } from "../../utils/feature-flags";
import { IChartRenderStrategy } from "./strategies/IChartRenderStrategy";
import { BasicChartRenderStrategy } from "./strategies/BasicChartRenderStrategy";
import { AdvancedChartRenderStrategy } from "./strategies/AdvancedChartRenderStrategy";

/**
 * Handles the rendering of charts to various formats using strategy pattern
 */
export class ChartRenderer {
  private static strategy: IChartRenderStrategy;

  /**
   * Get the appropriate rendering strategy based on feature flags
   */
  private static getStrategy(): IChartRenderStrategy {
    if (!this.strategy) {
      if (flags.newChartRendering) {
        logger.info("Using advanced chart rendering strategy");
        this.strategy = new AdvancedChartRenderStrategy();
      } else {
        logger.info("Using basic chart rendering strategy");
        this.strategy = new BasicChartRenderStrategy();
      }
    }
    return this.strategy;
  }

  /**
   * Reset the strategy (useful for testing or configuration changes)
   */
  static resetStrategy(): void {
    this.strategy = null as any;
  }

  /**
   * Render a chart as a PNG image buffer
   * @param chartData Data to render
   * @param options Rendering options
   * @returns Buffer containing the PNG image
   */
  static async renderPNG(
    chartData: ChartData,
    options?: Partial<ChartOptions>
  ): Promise<Buffer | null> {
    try {
      const strategy = this.getStrategy();
      return await strategy.renderPNG(chartData, options);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Failed to render chart as PNG"
      );
      return null;
    }
  }

  /**
   * Create a simple HTML representation of chart data
   * @param chartData Data to render
   * @param options Rendering options
   * @returns HTML string
   */
  static renderHTML(
    chartData: ChartData,
    options: Partial<ChartOptions> = {}
  ): string {
    try {
      const strategy = this.getStrategy();
      return strategy.renderHTML(chartData, options);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Failed to render chart as HTML"
      );
      return `<html><body><h1>Error rendering chart</h1><p>${error}</p></body></html>`;
    }
  }
}
