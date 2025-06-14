import { BaseChartRenderStrategy } from './BaseChartRenderStrategy';
import { ChartData, ChartOptions } from '../ChartService';
import { logger } from '../../../lib/logger';

/**
 * Advanced chart rendering strategy using Chart.js for full-featured rendering
 */
export class AdvancedChartRenderStrategy extends BaseChartRenderStrategy {
  override async renderPNG(_chartData: ChartData, options?: Partial<ChartOptions>): Promise<Buffer | null> {
    try {
      logger.info(`Rendering advanced PNG chart: ${options?.title ?? 'Untitled'}`);

      // This would be the actual Chart.js implementation when ready
      // const chartJS = await import("chart.js");
      // const { createCanvas } = await import("canvas");
      // const canvas = createCanvas(options?.width || 800, options?.height || 600);
      // const ctx = canvas.getContext("2d");
      // const chart = new chartJS.Chart(ctx, {
      //   type: 'bar',
      //   data: chartData,
      //   options: options
      // });
      // return canvas.toBuffer();

      // Placeholder for now - would be replaced with actual Chart.js rendering
      const advancedChartBuffer = Buffer.from('Advanced chart rendering output');
      return advancedChartBuffer;
    } catch (error) {
      this.logError(error, 'Failed to render advanced chart as PNG');
      return null;
    }
  }

  /**
   * Override to customize the chart title
   */
  protected override getChartTitle(title: string | undefined): string {
    return `${title ?? 'Chart'} (Advanced)`;
  }

  /**
   * Override to add enhanced styling to dataset headers
   */
  protected override buildDatasetHeaders(chartData: ChartData): string {
    return chartData.datasets
      .map(dataset => `<th style="padding: 12px; border: 1px solid #ddd;">${dataset.label}</th>`)
      .join('');
  }

  /**
   * Override to add enhanced styling to data rows
   */
  protected override buildDataRows(chartData: ChartData): string {
    return chartData.labels
      .map((label, index) => {
        let row = `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${label}</td>`;
        chartData.datasets.forEach(dataset => {
          row += `<td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${dataset.data[index]}</td>`;
        });
        row += `</tr>`;
        return row;
      })
      .join('');
  }

  /**
   * Override to add enhanced styling to legend
   */
  protected override buildLegend(chartData: ChartData): string {
    let legendSection = '<div class="legend" style="margin-top: 20px;"><h3>Legend</h3>';

    chartData.datasets.forEach(dataset => {
      const colors = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor : [dataset.backgroundColor];

      legendSection += `<div class="legend-item" style="display: flex; align-items: center; margin: 5px 0;">
        <div class="color-box" style="width: 20px; height: 20px; background-color: ${colors[0]}; margin-right: 10px; border-radius: 3px;"></div>
        <span style="font-weight: 500;">${dataset.label}</span>
      </div>`;
    });

    legendSection += '</div>';
    return legendSection;
  }

  /**
   * Override to provide advanced error message
   */
  protected override renderErrorHTML(error: unknown): string {
    return `<html><body><h1>Error rendering advanced chart</h1><p>${error}</p></body></html>`;
  }
}
