import { IChartRenderStrategy } from "./IChartRenderStrategy";
import { ChartData, ChartOptions } from "../ChartService";
import { logger } from "../../../lib/logger";
import { TemplateEngine } from "../../../utils/template";

/**
 * Basic chart rendering strategy that provides simple mock implementations
 */
export class BasicChartRenderStrategy implements IChartRenderStrategy {
  async renderPNG(
    _chartData: ChartData,
    options?: Partial<ChartOptions>
  ): Promise<Buffer | null> {
    try {
      logger.info(`Rendering basic PNG chart: ${options?.title || "Untitled"}`);

      // Basic mock implementation
      const mockChartBuffer = Buffer.from("Basic chart rendering output");
      return mockChartBuffer;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Failed to render basic chart as PNG"
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

      // Prepare template variables
      const backgroundColor = chartOptions.lightMode ? "#ffffff" : "#2b2b2b";
      const textColor = chartOptions.lightMode ? "#333333" : "#ffffff";
      const headerBackgroundColor = chartOptions.lightMode
        ? "#f2f2f2"
        : "#444444";

      // Build dataset headers
      const datasetHeaders = chartData.datasets
        .map((dataset) => `<th>${dataset.label}</th>`)
        .join("");

      // Build data rows
      const dataRows = chartData.labels
        .map((label, index) => {
          let row = `<tr><td>${label}</td>`;
          chartData.datasets.forEach((dataset) => {
            row += `<td>${dataset.data[index]}</td>`;
          });
          row += `</tr>`;
          return row;
        })
        .join("");

      // Build legend section
      let legendSection = "";
      if (chartOptions.showLegend) {
        legendSection = '<div class="legend"><h3>Legend</h3>';

        chartData.datasets.forEach((dataset) => {
          const colors = Array.isArray(dataset.backgroundColor)
            ? dataset.backgroundColor
            : [dataset.backgroundColor];

          legendSection += `<div class="legend-item">
            <div class="color-box" style="background-color: ${colors[0]}"></div>
            <span>${dataset.label}</span>
          </div>`;
        });

        legendSection += "</div>";
      }

      // Render using template
      return TemplateEngine.render("chart.html", {
        title: chartOptions.title || "Chart",
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
        "Failed to render basic chart as HTML"
      );
      return `<html><body><h1>Error rendering chart</h1><p>${error}</p></body></html>`;
    }
  }
}
