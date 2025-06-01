import { IChartRenderStrategy } from "./IChartRenderStrategy";
import { ChartData, ChartOptions } from "../ChartService";
import { logger } from "../../../lib/logger";
import { TemplateEngine } from "../../../utils/template";

/**
 * Advanced chart rendering strategy using Chart.js for full-featured rendering
 */
export class AdvancedChartRenderStrategy implements IChartRenderStrategy {
  async renderPNG(
    _chartData: ChartData,
    options?: Partial<ChartOptions>
  ): Promise<Buffer | null> {
    try {
      logger.info(
        `Rendering advanced PNG chart: ${options?.title || "Untitled"}`
      );

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
      const advancedChartBuffer = Buffer.from(
        "Advanced chart rendering output"
      );
      return advancedChartBuffer;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Failed to render advanced chart as PNG"
      );
      return null;
    }
  }

  renderHTML(
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

      // For advanced rendering, we could generate interactive HTML with Chart.js
      // This is a simplified version that still uses the template but with enhanced styling

      const backgroundColor = chartOptions.lightMode ? "#ffffff" : "#2b2b2b";
      const textColor = chartOptions.lightMode ? "#333333" : "#ffffff";
      const headerBackgroundColor = chartOptions.lightMode
        ? "#f2f2f2"
        : "#444444";

      // Build dataset headers with enhanced styling
      const datasetHeaders = chartData.datasets
        .map(
          (dataset) =>
            `<th style="padding: 12px; border: 1px solid #ddd;">${dataset.label}</th>`
        )
        .join("");

      // Build data rows with enhanced styling
      const dataRows = chartData.labels
        .map((label, index) => {
          let row = `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${label}</td>`;
          chartData.datasets.forEach((dataset) => {
            row += `<td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${dataset.data[index]}</td>`;
          });
          row += `</tr>`;
          return row;
        })
        .join("");

      // Enhanced legend with better styling
      let legendSection = "";
      if (chartOptions.showLegend) {
        legendSection =
          '<div class="legend" style="margin-top: 20px;"><h3>Legend</h3>';

        chartData.datasets.forEach((dataset) => {
          const colors = Array.isArray(dataset.backgroundColor)
            ? dataset.backgroundColor
            : [dataset.backgroundColor];

          legendSection += `<div class="legend-item" style="display: flex; align-items: center; margin: 5px 0;">
            <div class="color-box" style="width: 20px; height: 20px; background-color: ${colors[0]}; margin-right: 10px; border-radius: 3px;"></div>
            <span style="font-weight: 500;">${dataset.label}</span>
          </div>`;
        });

        legendSection += "</div>";
      }

      // Render using template with enhanced styling
      return TemplateEngine.render("chart.html", {
        title: `${chartOptions.title} (Advanced)`,
        backgroundColor,
        textColor,
        headerBackgroundColor,
        width: chartOptions.width.toString(),
        legendDisplay: chartOptions.showLegend ? "block" : "none",
        datasetHeaders,
        dataRows,
        legendSection,
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Failed to render advanced chart as HTML"
      );
      return `<html><body><h1>Error rendering advanced chart</h1><p>${error}</p></body></html>`;
    }
  }
}
