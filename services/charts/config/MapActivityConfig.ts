import { COLORS } from "./common";
import type { ChartConfiguration } from "chart.js";

export const MapActivityConfig: ChartConfiguration<"line"> = {
  type: "line",
  data: {
    labels: [], // Will be populated with dates
    datasets: [
      {
        label: "Systems",
        data: [], // Will be populated with system counts
        backgroundColor: COLORS[0] + "40", // semi-transparent fill
        borderColor: COLORS[0],
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
      {
        label: "Signatures",
        data: [], // Will be populated with signature counts
        backgroundColor: COLORS[1] + "40", // semi-transparent fill
        borderColor: COLORS[1],
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
    ],
  },
  options: {
    responsive: true,
    interaction: {
      mode: "index",
      intersect: false,
    },
    scales: {
      x: {
        type: "time",
        time: {
          unit: "day",
          displayFormats: {
            day: "MMM d",
          },
        },
        title: { display: true, text: "Date" },
      },
      y: {
        title: { display: true, text: "Count" },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          title: (items) => {
            const date = new Date(items[0].parsed.x);
            return date.toLocaleDateString();
          },
          label: (ctx) => {
            return `${ctx.dataset.label}: ${ctx.parsed.y}`;
          },
        },
      },
    },
  },
};
