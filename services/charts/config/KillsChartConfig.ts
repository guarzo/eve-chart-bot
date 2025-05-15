import type { ChartConfiguration } from "chart.js";
import { getThemeSettings, getThemeColors } from "./theme";

export const KillsChartConfig: ChartConfiguration<"bar"> = {
  type: "bar",
  data: {
    labels: [], // Will be populated with character names
    datasets: [
      {
        label: "Solo Kills",
        data: [], // Will be populated with solo kill counts
        backgroundColor: getThemeColors()[0],
        borderColor: getThemeColors()[0],
        borderWidth: 1,
      },
      {
        label: "Group Kills",
        data: [], // Will be populated with group kill counts (total - solo)
        backgroundColor: getThemeColors()[1],
        borderColor: getThemeColors()[1],
        borderWidth: 1,
      },
    ],
  },
  options: {
    indexAxis: "y",
    responsive: true,
    interaction: {
      mode: "index",
      intersect: false,
    },
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: "Kills",
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
        stacked: true,
        title: {
          display: true,
          text: "Character",
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
        position: "top",
        labels: {
          usePointStyle: true,
          color: getThemeSettings().text,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const value = ctx.parsed.x;
            const label = ctx.dataset.label;
            return `${label}: ${value}`;
          },
        },
      },
    },
  },
};
