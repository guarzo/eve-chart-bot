import { COLORS } from "./common";
import type { ChartConfiguration } from "chart.js";

export const DistributionChartConfig: ChartConfiguration<"bar"> = {
  type: "bar",
  data: {
    labels: [], // Will be populated with bucket labels
    datasets: [
      {
        label: "Attacker Count",
        data: [], // Will be populated with bucket counts
        backgroundColor: COLORS[1] + "80", // semi-transparent
        borderColor: COLORS[1],
        borderWidth: 1,
      },
    ],
  },
  options: {
    scales: {
      x: {
        title: { display: true, text: "Number of Attackers" },
      },
      y: {
        title: { display: true, text: "Kills" },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.y} kills with ${ctx.label} attackers`,
        },
      },
    },
  },
};
