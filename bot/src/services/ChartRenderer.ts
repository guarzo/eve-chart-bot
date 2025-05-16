import {
  Chart,
  ChartConfiguration,
  ChartData,
  ChartOptions,
  ChartType,
  registerables,
  ChartDataset,
  LineControllerDatasetOptions,
  BarControllerDatasetOptions,
  PieControllerDatasetOptions,
  DoughnutControllerDatasetOptions,
} from "chart.js";
import { createCanvas, Canvas } from "canvas";
import { logger } from "../lib/logger";
import { theme, chartPalette } from "./charts/config/theme";
import { ChartDisplayType } from "../types/chart";
import {
  ChartData as CustomChartData,
  ChartDataset as CustomChartDataset,
  ChartOptions as CustomChartOptions,
} from "../types/chart";

// Register all Chart.js components
Chart.register(...registerables);

export class ChartRenderer {
  private width: number;
  private height: number;
  private colors: string[] = chartPalette;
  private chart: Chart | null = null;

  constructor(width: number = 1200, height: number = 800) {
    this.width = width;
    this.height = height;
  }

  /**
   * Convert custom chart data to Chart.js format
   */
  private convertToChartJSData(data: CustomChartData): ChartData {
    const datasets = data.datasets.map((dataset, index) => {
      const type = this.getChartType(dataset.displayType || dataset.type);
      const baseDataset = {
        ...dataset,
        type,
        backgroundColor:
          dataset.backgroundColor || this.getBackgroundColor(index, type),
        borderColor:
          dataset.borderColor ||
          this.adjustColorOpacity(this.getBackgroundColor(index, type), 0.8),
        borderWidth: dataset.borderWidth || 1,
      };

      // Add type-specific properties
      switch (type) {
        case "line":
          return {
            ...baseDataset,
            fill: dataset.fill ?? false,
            tension: dataset.tension ?? 0.4,
            pointBackgroundColor: this.getBackgroundColor(index, type),
            pointBorderColor: "#fff",
            pointBorderWidth: 1,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: this.getBackgroundColor(index, type),
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 2,
          } as ChartDataset<"line">;
        case "bar":
          return {
            ...baseDataset,
            barPercentage: 0.8,
            categoryPercentage: 0.9,
            stack: "stack0",
          } as ChartDataset<"bar">;
        case "pie":
          return {
            ...baseDataset,
            hoverOffset: 4,
          } as ChartDataset<"pie">;
        case "doughnut":
          return {
            ...baseDataset,
            hoverOffset: 4,
          } as ChartDataset<"doughnut">;
        default:
          return baseDataset as ChartDataset;
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
  private getChartType(type?: string): ChartType {
    // First handle our internal source types
    if (type === "kills" || type === "map_activity") {
      return "line"; // Default to line chart for these data sources
    }

    // Then handle display types
    switch (type) {
      case "boxplot":
      case "violin":
      case "heatmap":
      case "calendar":
        return "bar";
      default:
        return (type as ChartType) || "bar";
    }
  }

  /**
   * Get background color for a dataset
   */
  private getBackgroundColor(index: number, type?: string): string {
    const colorIndex = index % this.colors.length;
    return this.colors[colorIndex];
  }

  /**
   * Adjust color opacity
   */
  private adjustColorOpacity(color: string, opacity: number): string {
    if (color.startsWith("#")) {
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
  private createChartConfig(
    data: CustomChartData,
    options: CustomChartOptions = {}
  ): ChartConfiguration {
    const chartData = this.convertToChartJSData(data);
    const chartOptions: ChartOptions = {
      responsive: options.responsive ?? true,
      maintainAspectRatio: options.maintainAspectRatio ?? false,
      plugins: {
        legend: {
          position: "top",
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
            label: (context) => {
              const label = context.dataset.label || "";
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

    return {
      type: this.getChartType(data.displayType),
      data: chartData,
      options: chartOptions,
    };
  }

  /**
   * Render chart to buffer
   */
  async renderToBuffer(
    data: CustomChartData,
    options: CustomChartOptions = {}
  ): Promise<Buffer> {
    try {
      const config = this.createChartConfig(data, options);
      const canvas = createCanvas(options.width || 800, options.height || 400);

      // Set background color
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = theme.colors.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Create and render the chart
      this.chart = new Chart(canvas as unknown as HTMLCanvasElement, config);
      await this.chart.render();

      // Use the correct toBuffer call
      return canvas.toBuffer();
    } catch (error) {
      logger.error("Error rendering chart to buffer:", error);
      throw error;
    }
  }

  /**
   * Render chart to base64 string
   */
  async renderToBase64(
    data: CustomChartData,
    options: CustomChartOptions = {}
  ): Promise<string> {
    try {
      const buffer = await this.renderToBuffer(data, options);
      return buffer.toString("base64");
    } catch (error) {
      logger.error("Error rendering chart to base64:", error);
      throw error;
    }
  }
}
