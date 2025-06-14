import { IChartRenderStrategy } from './IChartRenderStrategy';
import { ChartData, ChartOptions } from '../ChartService';
import { logger } from '../../../lib/logger';
import { TemplateEngine } from '../../../utils/template';
import { Configuration } from '../../../config';

/**
 * Base abstract class for chart rendering strategies
 * Provides common functionality for all chart renderers
 */
export abstract class BaseChartRenderStrategy implements IChartRenderStrategy {
  /**
   * Abstract method for PNG rendering - must be implemented by subclasses
   */
  abstract renderPNG(chartData: ChartData, options?: Partial<ChartOptions>): Promise<Buffer | null>;

  /**
   * Base HTML rendering implementation with hooks for customization
   */
  async renderHTML(chartData: ChartData, options: Partial<ChartOptions> = {}): Promise<string> {
    try {
      const chartOptions = this.mergeChartOptions(options);
      const colors = this.getColorScheme(chartOptions.lightMode);

      // Build chart components
      const datasetHeaders = this.buildDatasetHeaders(chartData);
      const dataRows = this.buildDataRows(chartData);
      const legendSection = chartOptions.showLegend ? this.buildLegend(chartData) : '';

      // Allow subclasses to customize the title
      const title = this.getChartTitle(chartOptions.title);

      // Render using template
      return await TemplateEngine.render('chart.html', {
        title,
        backgroundColor: colors.backgroundColor,
        textColor: colors.textColor,
        headerBackgroundColor: colors.headerBackgroundColor,
        width: chartOptions.width.toString(),
        legendDisplay: chartOptions.showLegend ? 'block' : 'none',
        datasetHeaders,
        dataRows,
        legendSection,
      });
    } catch (error) {
      this.logError(error, 'Failed to render chart as HTML');
      return this.renderErrorHTML(error);
    }
  }

  /**
   * Merge provided options with defaults
   */
  protected mergeChartOptions(options: Partial<ChartOptions>): ChartOptions {
    return {
      width: options.width ?? Configuration.charts.defaultWidth,
      height: options.height ?? Configuration.charts.defaultHeight,
      title: options.title ?? 'Chart',
      showLegend: options.showLegend ?? true,
      showLabels: options.showLabels ?? true,
      lightMode: options.lightMode ?? false,
    };
  }

  /**
   * Get color scheme based on light/dark mode
   */
  protected getColorScheme(lightMode: boolean) {
    return {
      backgroundColor: lightMode ? '#ffffff' : '#2b2b2b',
      textColor: lightMode ? '#333333' : '#ffffff',
      headerBackgroundColor: lightMode ? '#f2f2f2' : '#444444',
    };
  }

  /**
   * Build dataset headers - can be overridden by subclasses
   */
  protected buildDatasetHeaders(chartData: ChartData): string {
    return chartData.datasets.map(dataset => `<th>${dataset.label}</th>`).join('');
  }

  /**
   * Build data rows - can be overridden by subclasses
   */
  protected buildDataRows(chartData: ChartData): string {
    return chartData.labels
      .map((label, index) => {
        let row = `<tr><td>${label}</td>`;
        chartData.datasets.forEach(dataset => {
          row += `<td>${dataset.data[index]}</td>`;
        });
        row += `</tr>`;
        return row;
      })
      .join('');
  }

  /**
   * Build legend section - can be overridden by subclasses
   */
  protected buildLegend(chartData: ChartData): string {
    let legendSection = '<div class="legend"><h3>Legend</h3>';

    chartData.datasets.forEach(dataset => {
      const colors = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor : [dataset.backgroundColor];

      legendSection += `<div class="legend-item">
        <div class="color-box" style="background-color: ${colors[0]}"></div>
        <span>${dataset.label}</span>
      </div>`;
    });

    legendSection += '</div>';
    return legendSection;
  }

  /**
   * Get chart title - can be overridden by subclasses
   */
  protected getChartTitle(title: string | undefined): string {
    return title ?? 'Chart';
  }

  /**
   * Log error with consistent format
   */
  protected logError(error: unknown, message: string): void {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      message
    );
  }

  /**
   * Render error HTML - can be overridden by subclasses
   */
  protected renderErrorHTML(error: unknown): string {
    return `<html><body><h1>Error rendering chart</h1><p>${error}</p></body></html>`;
  }
}
