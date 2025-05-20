import Chart from "chart.js/auto";
import { MatrixController, MatrixElement } from "chartjs-chart-matrix";
import {
  BoxPlotController,
  ViolinController,
} from "@sgratzl/chartjs-chart-boxplot";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { theme } from "./theme.js";

// Register all plugins
Chart.register(
  // Matrix (heatmap) plugin
  MatrixController,
  MatrixElement,

  // Boxplot and Violin plugins
  BoxPlotController,
  ViolinController,

  // DataLabels plugin
  ChartDataLabels
);

// Configure global plugin options
Chart.defaults.set("plugins.datalabels", {
  color: theme.colors.text.primary,
  font: {
    weight: "bold",
  },
  formatter: (value: unknown) => {
    return typeof value === "number" ? value.toFixed(1) : value;
  },
});

// Configure global chart options
Chart.defaults.font.family =
  "'Inter', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = theme.colors.text.primary;
Chart.defaults.plugins.legend.position = "top";
Chart.defaults.plugins.tooltip.mode = "index";
Chart.defaults.plugins.tooltip.intersect = false;
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;

// Configure global scales (set only supported properties)
if (Chart.defaults.scales) {
  if (Chart.defaults.scales.linear) {
    Chart.defaults.scales.linear.grid = Chart.defaults.scales.linear.grid || {};
    Chart.defaults.scales.linear.grid.color = theme.grid.color;
    Chart.defaults.scales.linear.ticks =
      Chart.defaults.scales.linear.ticks || {};
    Chart.defaults.scales.linear.ticks.color = theme.colors.text.primary;
  }
  if (Chart.defaults.scales.category) {
    Chart.defaults.scales.category.grid =
      Chart.defaults.scales.category.grid || {};
    Chart.defaults.scales.category.grid.color = theme.grid.color;
    Chart.defaults.scales.category.ticks =
      Chart.defaults.scales.category.ticks || {};
    Chart.defaults.scales.category.ticks.color = theme.colors.text.primary;
  }
}

// Configure global tooltip
Chart.defaults.plugins.tooltip.backgroundColor = theme.colors.background;
Chart.defaults.plugins.tooltip.titleColor = theme.colors.text.primary;
Chart.defaults.plugins.tooltip.bodyColor = theme.colors.text.primary;
Chart.defaults.plugins.tooltip.borderColor = theme.colors.primary;
Chart.defaults.plugins.tooltip.borderWidth = 1;
