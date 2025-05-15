import type { ChartConfiguration } from "chart.js";
import { getThemeSettings, getThemeColors } from "./theme";

export const EfficiencyBulletConfig: ChartConfiguration<"bar"> = {
  type: "bar",
  data: {
    labels: [], // Will be populated with character names
    datasets: [
      {
        label: "Efficiency",
        data: [], // Will be populated with efficiency percentages
        backgroundColor: getThemeColors()[2],
        borderColor: getThemeColors()[2],
        borderWidth: 1,
      },
      {
        label: "Target",
        data: [], // Will be populated with target values (e.g., 100)
        backgroundColor: getThemeColors()[3],
        borderColor: getThemeColors()[3],
        borderWidth: 1,
        type: "line",
        pointRadius: 0,
        borderDash: [5, 5],
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
        min: 0,
        max: 100,
        title: {
          display: true,
          text: "Efficiency (%)",
          color: getThemeSettings().text,
        },
        grid: {
          color: getThemeSettings().grid,
        },
        ticks: {
          color: getThemeSettings().text,
          callback: (value) => `${value}%`,
        },
      },
      y: {
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
            if (ctx.dataset.type === "line") {
              return `Target: ${ctx.parsed.x}%`;
            }
            return `Efficiency: ${ctx.parsed.x}%`;
          },
        },
      },
    },
  },
};
