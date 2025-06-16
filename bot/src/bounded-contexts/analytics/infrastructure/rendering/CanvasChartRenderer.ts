/**
 * Canvas Chart Renderer
 * Infrastructure implementation for rendering charts using Chart.js and canvas
 */

import { IChartRenderer } from '../../application/services/IChartService';
import { ChartData } from '../../domain/value-objects/ChartData';
import { ChartConfiguration } from '../../domain/value-objects/ChartConfiguration';
import { ChartType } from '../../../../shared/types/common';
import { createCanvas, Canvas } from 'canvas';
import { Chart } from 'chart.js';
import type { ChartConfiguration as ChartJsConfig } from 'chart.js';
import { logger } from '../../../../lib/logger';

export class CanvasChartRenderer implements IChartRenderer {
  private readonly defaultWidth = 800;
  private readonly defaultHeight = 600;

  constructor() {
    // Initialize Chart.js with canvas adapter
    this.initializeChartJs();
  }

  /**
   * Render chart data to image buffer
   */
  async render(data: ChartData, config: ChartConfiguration): Promise<Buffer> {
    const startTime = Date.now();

    try {
      // Create canvas
      const canvas = this.createCanvas(config);
      
      // Build Chart.js configuration
      const chartJsConfig = this.buildChartJsConfig(data, config);
      
      // Render the chart
      const chart = new Chart(canvas.getContext('2d') as any, chartJsConfig);
      
      // Convert to buffer
      const buffer = canvas.toBuffer('image/png');
      
      // Clean up
      chart.destroy();

      const renderTime = Date.now() - startTime;
      logger.debug('Chart rendered', {
        type: config.type,
        renderTimeMs: renderTime,
        size: buffer.length
      });

      return buffer;

    } catch (error) {
      logger.error('Chart rendering failed', {
        error,
        type: config.type
      });
      throw new Error('Failed to render chart');
    }
  }

  /**
   * Get supported output formats
   */
  getSupportedFormats(): string[] {
    return ['png', 'jpeg', 'pdf'];
  }

  /**
   * Initialize Chart.js with required plugins
   */
  private initializeChartJs(): void {
    // Chart.js initialization if needed
    // Plugins would be registered here
  }

  /**
   * Create canvas with specified dimensions
   */
  private createCanvas(config: ChartConfiguration): Canvas {
    const width = config.displayOptions.width || this.defaultWidth;
    const height = config.displayOptions.height || this.defaultHeight;
    
    return createCanvas(width, height);
  }

  /**
   * Build Chart.js configuration from our domain objects
   */
  private buildChartJsConfig(data: ChartData, config: ChartConfiguration): ChartJsConfig {
    const chartType = this.mapChartType(config.type);
    
    return {
      type: chartType as any,
      data: {
        labels: data.labels,
        datasets: data.datasets.map(dataset => ({
          label: dataset.label,
          data: dataset.data,
          backgroundColor: dataset.backgroundColor,
          borderColor: dataset.borderColor,
          borderWidth: dataset.borderWidth,
          fill: dataset.fill
        }))
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: config.displayOptions.showLegend,
            position: 'top'
          },
          title: {
            display: true,
            text: this.getChartTitle(config)
          }
        },
        scales: this.buildScales(config)
      }
    };
  }

  /**
   * Map our chart types to Chart.js types
   */
  private mapChartType(type: ChartType): string {
    switch (type) {
      case ChartType.KILLS:
      case ChartType.LOSSES:
        return 'bar';
      case ChartType.EFFICIENCY:
        return 'line';
      case ChartType.HEATMAP:
        return 'bubble';
      case ChartType.DISTRIBUTION:
        return 'pie';
      case ChartType.TREND:
        return 'line';
      default:
        return 'bar';
    }
  }

  /**
   * Build scales configuration based on chart type
   */
  private buildScales(config: ChartConfiguration): any {
    const scales: any = {
      x: {
        display: config.displayOptions.showGrid,
        grid: {
          display: config.displayOptions.showGrid,
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#ffffff'
        }
      },
      y: {
        display: config.displayOptions.showGrid,
        grid: {
          display: config.displayOptions.showGrid,
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#ffffff'
        },
        beginAtZero: true
      }
    };

    // Customize scales based on chart type
    if (config.type === ChartType.EFFICIENCY) {
      scales.y.max = 100; // Efficiency is 0-100%
    }

    return scales;
  }

  /**
   * Generate chart title based on configuration
   */
  private getChartTitle(config: ChartConfiguration): string {
    const startStr = config.startDate.toLocaleDateString();
    const endStr = config.endDate.toLocaleDateString();
    
    switch (config.type) {
      case ChartType.KILLS:
        return `Kills Report (${startStr} - ${endStr})`;
      case ChartType.LOSSES:
        return `Losses Report (${startStr} - ${endStr})`;
      case ChartType.EFFICIENCY:
        return `Efficiency Report (${startStr} - ${endStr})`;
      default:
        return `Chart (${startStr} - ${endStr})`;
    }
  }
}