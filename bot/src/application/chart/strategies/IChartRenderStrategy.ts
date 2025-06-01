import { ChartData, ChartOptions } from "../ChartService";

/**
 * Interface for chart rendering strategies
 */
export interface IChartRenderStrategy {
  /**
   * Render chart data as a PNG buffer
   * @param chartData Data to render
   * @param options Rendering options
   * @returns Buffer containing the PNG image or null if rendering fails
   */
  renderPNG(
    chartData: ChartData,
    options?: Partial<ChartOptions>
  ): Promise<Buffer | null>;

  /**
   * Render chart data as HTML
   * @param chartData Data to render
   * @param options Rendering options
   * @returns HTML string representation of the chart
   */
  renderHTML(chartData: ChartData, options?: Partial<ChartOptions>): string;
}
