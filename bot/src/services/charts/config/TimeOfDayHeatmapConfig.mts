import type { ChartConfiguration, Point } from "chart.js";
import { theme } from "./theme.js";

interface MatrixDataPoint extends Point {
  v: number;
}

interface MatrixDataset {
  label: string;
  data: MatrixDataPoint[];
  backgroundColor: (ctx: {
    dataset: { data: MatrixDataPoint[] };
    dataIndex: number;
  }) => string;
  width: (ctx: { chart: any }) => number;
  height: (ctx: { chart: any }) => number;
  borderWidth: number;
  borderColor: string;
}

/**
 * Simple linear color scale: light → dark
 */
function getColorForValue(v: number, max: number): string {
  const alpha = Math.min(1, v / max);
  return `rgba(0, 114, 178, ${alpha})`; // Using theme color directly
}

// Extend ChartTypeRegistry to include matrix type
declare module "chart.js" {
  interface ChartTypeRegistry {
    matrix: {
      chartOptions: any;
      datasetOptions: any;
      defaultDataPoint: MatrixDataPoint;
    };
  }
}

export const TimeOfDayHeatmapConfig: ChartConfiguration<
  "matrix",
  MatrixDataPoint[],
  string
> = {
  type: "matrix" as const,
  data: {
    datasets: [
      {
        label: "Kills by Hour / Weekday",
        data: [], // Will be populated with {x: hour, y: weekday, v: count}
        backgroundColor(ctx: {
          dataset: { data: MatrixDataPoint[] };
          dataIndex: number;
        }) {
          const max = Math.max(...ctx.dataset.data.map((d) => d.v));
          return getColorForValue(ctx.dataset.data[ctx.dataIndex].v, max);
        },
        width: ({ chart }: { chart: any }) => chart.chartArea.width / 24 - 1,
        height: ({ chart }: { chart: any }) => chart.chartArea.height / 7 - 1,
        borderWidth: 1,
        borderColor: theme.grid.color,
      } as MatrixDataset,
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
          color: theme.text.primary,
        },
        grid: {
          color: theme.grid.color,
        },
        ticks: {
          color: theme.text.primary,
        },
      },
      y: {
        type: "category",
        labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        title: {
          display: true,
          text: "Weekday",
          color: theme.text.primary,
        },
        grid: {
          color: theme.grid.color,
        },
        ticks: {
          color: theme.text.primary,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
        labels: {
          color: theme.text.primary,
        },
      },
      tooltip: {
        callbacks: {
          title: ([ctx]: [{ raw: MatrixDataPoint; chart: any }]) => {
            const { x, y } = ctx.raw;
            const data = ctx.chart.data.datasets[0].data;
            return `Day: ${data[y]?.y ?? "Unknown"}, Hour: ${x}:00`;
          },
          label: (ctx: { raw: MatrixDataPoint }) => {
            const { v } = ctx.raw;
            return ` ${v} kills`;
          },
        },
      },
    },
  },
};
