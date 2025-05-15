import Chart from "chart.js/auto";
import { MatrixController, MatrixElement } from "chartjs-chart-matrix";
import type { ChartConfiguration } from "chart.js";
import { getThemeSettings, getThemeColors } from "./theme";

// Register the matrix (heatmap) controller and element
Chart.register(MatrixController, MatrixElement);

/**
 * Simple linear color scale: light → dark
 */
function getColorForValue(v: number, max: number): string {
  const alpha = Math.min(1, v / max);
  return Chart.helpers.color(getThemeColors()[4]).alpha(alpha).rgbString();
}

export const TimeOfDayHeatmapConfig: ChartConfiguration<"matrix"> = {
  type: "matrix",
  data: {
    datasets: [
      {
        label: "Kills by Hour / Weekday",
        data: [], // Will be populated with {x: hour, y: weekday, v: count}
        backgroundColor(ctx) {
          const max = Math.max(...ctx.dataset.data.map((d: any) => d.v));
          return getColorForValue(ctx.dataset.data[ctx.dataIndex].v, max);
        },
        width: ({ chart }) => chart.chartArea.width / 24 - 1,
        height: ({ chart }) => chart.chartArea.height / 7 - 1,
        borderWidth: 1,
        borderColor: getThemeSettings().border,
      },
    ],
  },
  options: {
    maintainAspectRatio: false,
    scales: {
      x: {
        type: "category",
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        title: {
          display: true,
          text: "Hour of Day (UTC)",
          color: getThemeSettings().text,
        },
        grid: {
          color: getThemeSettings().grid,
        },
        ticks: {
          color: getThemeSettings().text,
        },
      },
      y: {
        type: "category",
        labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        title: {
          display: true,
          text: "Weekday",
          color: getThemeSettings().text,
        },
        grid: {
          color: getThemeSettings().grid,
        },
        ticks: {
          color: getThemeSettings().text,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
        labels: {
          color: getThemeSettings().text,
        },
      },
      tooltip: {
        callbacks: {
          title: ([ctx]) => {
            const { x, y } = ctx.raw as any;
            return `Day: ${ctx.chart.data.datasets[0].data[y].y}, Hour: ${x}:00`;
          },
          label: (ctx) => {
            const { v } = ctx.raw as any;
            return ` ${v} kills`;
          },
        },
      },
    },
  },
};
