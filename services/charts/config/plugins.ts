import Chart from "chart.js/auto";
import { MatrixController, MatrixElement } from "chartjs-chart-matrix";
import { BoxPlotController, ViolinController } from "chartjs-chart-boxplot";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { getThemeSettings } from "./theme";

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
Chart.defaults.plugins.datalabels = {
  color: getThemeSettings().text,
  font: {
    weight: "bold",
  },
  formatter: (value: number) => {
    return value.toFixed(1);
  },
};

// Configure global chart options
Chart.defaults.font.family =
  "'Inter', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = getThemeSettings().text;
Chart.defaults.plugins.legend.position = "top";
Chart.defaults.plugins.tooltip.mode = "index";
Chart.defaults.plugins.tooltip.intersect = false;
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;

// Configure global scales
Chart.defaults.scale.grid.color = getThemeSettings().grid;
Chart.defaults.scale.border.color = getThemeSettings().border;
Chart.defaults.scale.ticks.color = getThemeSettings().text;

// Configure global tooltip
Chart.defaults.plugins.tooltip.backgroundColor =
  getThemeSettings().tooltip.background;
Chart.defaults.plugins.tooltip.titleColor = getThemeSettings().tooltip.text;
Chart.defaults.plugins.tooltip.bodyColor = getThemeSettings().tooltip.text;
Chart.defaults.plugins.tooltip.borderColor = getThemeSettings().tooltip.border;
Chart.defaults.plugins.tooltip.borderWidth = 1;
