import { ChartData, ChartOptions } from "./ChartService";
import { logger } from "../../lib/logger";
import { flags } from "../../utils/feature-flags";

/**
 * Handles the rendering of charts to various formats
 */
export class ChartRenderer {
  /**
   * Render a chart as a PNG image buffer
   * @param chartData Data to render
   * @param options Rendering options
   * @returns Buffer containing the PNG image
   */
  static async renderPNG(
    chartData: ChartData,
    options: Partial<ChartOptions> = {}
  ): Promise<Buffer | null> {
    try {
      // Set default options
      const chartOptions: ChartOptions = {
        width: options.width || 800,
        height: options.height || 600,
        title: options.title,
        showLegend:
          options.showLegend !== undefined ? options.showLegend : true,
        showLabels:
          options.showLabels !== undefined ? options.showLabels : true,
        lightMode: options.lightMode !== undefined ? options.lightMode : false,
      };

      logger.info(`Rendering PNG chart: ${chartOptions.title || "Untitled"}`);

      // Use feature flag to conditionally enable advanced chart rendering
      if (flags.newChartRendering) {
        // Advanced chart rendering implementation
        logger.info("Using new chart rendering system (feature flag enabled)");
        try {
          // This would be the actual implementation when ready
          // const chartJS = await import("chart.js");
          // const canvas = createCanvas(chartOptions.width, chartOptions.height);
          // const ctx = canvas.getContext("2d");
          // const chart = new chartJS.Chart(ctx, {
          //   type: 'bar',
          //   data: chartData,
          //   options: chartOptions
          // });
          // return canvas.toBuffer();

          // Placeholder for now
          return Buffer.from("Advanced chart rendering output");
        } catch (error) {
          logger.error(
            "Error in advanced chart rendering, falling back to basic",
            error
          );
          // Fall back to basic rendering
        }
      }

      // Basic mock implementation
      logger.info("Using basic chart rendering (feature flag disabled)");
      const mockChartBuffer = Buffer.from("Basic chart rendering output");
      return mockChartBuffer;
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
   * Useful for debugging or when image rendering is not available
   * @param chartData Data to render
   * @param options Rendering options
   * @returns HTML string
   */
  static renderHTML(
    chartData: ChartData,
    options: Partial<ChartOptions> = {}
  ): string {
    try {
      const chartOptions: ChartOptions = {
        width: options.width || 800,
        height: options.height || 600,
        title: options.title || "Chart",
        showLegend:
          options.showLegend !== undefined ? options.showLegend : true,
        showLabels:
          options.showLabels !== undefined ? options.showLabels : true,
        lightMode: options.lightMode !== undefined ? options.lightMode : false,
      };

      const backgroundColor = chartOptions.lightMode ? "#ffffff" : "#2b2b2b";
      const textColor = chartOptions.lightMode ? "#333333" : "#ffffff";

      let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${chartOptions.title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: ${backgroundColor};
            color: ${textColor};
            margin: 0;
            padding: 20px;
          }
          .chart-container {
            width: ${chartOptions.width}px;
            max-width: 100%;
            margin: 0 auto;
          }
          h1 {
            text-align: center;
          }
          .legend {
            display: ${chartOptions.showLegend ? "block" : "none"};
            margin-top: 20px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
          }
          .color-box {
            width: 20px;
            height: 20px;
            margin-right: 8px;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          .data-table th, .data-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          .data-table th {
            background-color: ${chartOptions.lightMode ? "#f2f2f2" : "#444444"};
          }
        </style>
      </head>
      <body>
        <div class="chart-container">
          <h1>${chartOptions.title}</h1>
      `;

      // Add data table
      html += `
      <table class="data-table">
        <thead>
          <tr>
            <th>Label</th>
            ${chartData.datasets
              .map((dataset) => `<th>${dataset.label}</th>`)
              .join("")}
          </tr>
        </thead>
        <tbody>
      `;

      // Add rows for each label
      chartData.labels.forEach((label, index) => {
        html += `<tr><td>${label}</td>`;
        chartData.datasets.forEach((dataset) => {
          html += `<td>${dataset.data[index]}</td>`;
        });
        html += `</tr>`;
      });

      html += `
        </tbody>
      </table>
      `;

      // Add legend if enabled
      if (chartOptions.showLegend) {
        html += `<div class="legend"><h3>Legend</h3>`;

        chartData.datasets.forEach((dataset, datasetIndex) => {
          const colors = Array.isArray(dataset.backgroundColor)
            ? dataset.backgroundColor
            : [dataset.backgroundColor];

          html += `<div class="legend-item">
            <div class="color-box" style="background-color: ${colors[0]}"></div>
            <span>${dataset.label}</span>
          </div>`;
        });

        html += `</div>`;
      }

      html += `
        </div>
      </body>
      </html>
      `;

      return html;
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
