// Use require() for CommonJS modules with ESM dependencies
// @ts-ignore - Ignoring type checking for Chart.js imports
const chartJS = require('chart.js');
const { Chart, registerables } = chartJS;

import { createCanvas } from 'canvas';
import { logger } from '../lib/logger';
import { theme, chartPalette } from './charts/config/theme';
import { ChartData as CustomChartData, ChartOptions as CustomChartOptions } from '../types/chart';

// Register Chart.js components in non-test environments
if (process.env.NODE_ENV !== 'test') {
  try {
    Chart.register(...registerables);
  } catch (e) {
    logger.warn('Failed to register Chart.js components', e);
  }
}

export class ChartRenderer {
  // These dimensions are used by the constructor but not referenced elsewhere
  // @ts-expect-error - Used in constructor
  private width: number;
  // @ts-expect-error - Used in constructor
  private height: number;
  private colors: string[] = chartPalette;
  private chart: any = null;

  constructor(width: number = 1200, height: number = 800) {
    this.width = width;
    this.height = height;
  }

  /**
   * Convert custom chart data to Chart.js format
   */
  private convertToChartJSData(data: CustomChartData): any {
    const datasets = data.datasets.map((dataset, index) => {
      const type = this.getChartType(dataset.displayType ?? dataset.type);
      const baseDataset = {
        ...dataset,
        type,
        backgroundColor: dataset.backgroundColor ?? this.getBackgroundColor(index, type),
        borderColor: dataset.borderColor ?? this.adjustColorOpacity(this.getBackgroundColor(index, type), 0.8),
        borderWidth: dataset.borderWidth ?? 1,
      };

      // Add type-specific properties
      switch (type) {
        case 'line':
          return {
            ...baseDataset,
            fill: dataset.fill ?? false,
            tension: dataset.tension ?? 0.4,
            pointBackgroundColor: this.getBackgroundColor(index, type),
            pointBorderColor: '#fff',
            pointBorderWidth: 1,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: this.getBackgroundColor(index, type),
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
          };
        case 'bar':
          return {
            ...baseDataset,
            barPercentage: 0.8,
            categoryPercentage: 0.9,
            stack: 'stack0',
          };
        case 'pie':
          return {
            ...baseDataset,
            hoverOffset: 4,
          };
        case 'doughnut':
          return {
            ...baseDataset,
            hoverOffset: 4,
          };
        default:
          return baseDataset;
      }
    });

    return {
      labels: data.labels,
      datasets,
    };
  }

  /**
   * Get the appropriate Chart.js type for a custom chart type
   */
  private getChartType(type?: string): string {
    // First handle our internal source types
    if (type === 'kills' || type === 'map_activity') {
      return 'line'; // Default to line chart for these data sources
    }

    // Then handle display types
    switch (type) {
      case 'boxplot':
      case 'violin':
      case 'heatmap':
      case 'calendar':
        return 'bar';
      default:
        return type ?? 'bar';
    }
  }

  /**
   * Get background color for a dataset
   */
  private getBackgroundColor(index: number, type?: string): string {
    void type; // Explicitly mark as intentionally unused
    const colorIndex = index % this.colors.length;
    return this.colors[colorIndex];
  }

  /**
   * Adjust color opacity
   */
  private adjustColorOpacity(color: string, opacity: number): string {
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return color;
  }

  /**
   * Create chart configuration
   */
  private createChartConfig(data: CustomChartData, options: CustomChartOptions = {}): any {
    const chartData = this.convertToChartJSData(data);
    const chartOptions: any = {
      responsive: options.responsive ?? true,
      maintainAspectRatio: options.maintainAspectRatio ?? false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: theme.text.primary,
            font: {
              size: 12,
            },
          },
        },
        tooltip: {
          backgroundColor: theme.colors.background,
          titleColor: theme.text.primary,
          bodyColor: theme.text.primary,
          borderColor: theme.colors.primary,
          borderWidth: 1,
          padding: 10,
          displayColors: true,
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label ?? '';
              const value = context.parsed.y;
              return `${label}: ${value}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: theme.grid.color,
          },
          ticks: {
            color: theme.text.primary,
            font: {
              size: 12,
            },
          },
          stacked: true,
        },
        y: {
          grid: {
            color: theme.grid.color,
          },
          ticks: {
            color: theme.text.primary,
            font: {
              size: 12,
            },
          },
          stacked: true,
        },
      },
    };

    // Use the chart type but assign to a variable that will be used
    const chartType = this.getChartType(data.displayType);

    return {
      type: chartType,
      data: chartData,
      options: chartOptions,
    };
  }

  /**
   * Render chart to buffer
   */
  async renderToBuffer(data: CustomChartData, options: CustomChartOptions = {}): Promise<Buffer> {
    try {
      const config = this.createChartConfig(data, options);
      const canvas = createCanvas(options.width ?? 800, options.height ?? 400);

      // Set background color
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = theme.colors.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Create and render the chart
      this.chart = new Chart(canvas as unknown as HTMLCanvasElement, config);
      await this.chart.render();

      // Use the correct toBuffer call
      return canvas.toBuffer();
    } catch (error) {
      logger.error('Error rendering chart to buffer:', error);
      throw error;
    }
  }

  /**
   * Render chart to base64 string
   */
  async renderToBase64(data: CustomChartData, options: CustomChartOptions = {}): Promise<string> {
    try {
      const buffer = await this.renderToBuffer(data, options);
      return buffer.toString('base64');
    } catch (error) {
      logger.error('Error rendering chart to base64:', error);
      throw error;
    }
  }
}
