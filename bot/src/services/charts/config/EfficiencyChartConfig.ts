import type { ChartConfiguration } from "chart.js";
import { theme, chartPalette } from "./theme";

export const EfficiencyChartConfig: ChartConfiguration<"bar"> = {
  type: "bar",
  data: {
    labels: [], // Will be filled in by the generator
    datasets: [
      {
        label: "Target (100%)",
        data: [], // 100 for each group
        backgroundColor: "rgba(255,255,255,0.08)",
        barThickness: 16,
      },
      {
        label: "Efficiency %",
        data: [], // Actual efficiency per group
        backgroundColor: chartPalette[2], // green
        barThickness: 16,
      },
    ],
  },
  options: {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          usePointStyle: true,
          color: theme.text.primary,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.x}%`,
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Efficiency (%)",
          color: theme.text.primary,
        },
        beginAtZero: true,
        max: 100,
        grid: { color: theme.grid.color },
        ticks: { color: theme.text.primary },
      },
      y: {
        title: { display: false },
        grid: { color: theme.grid.color },
        ticks: { color: theme.text.primary },
      },
    },
  },
};
