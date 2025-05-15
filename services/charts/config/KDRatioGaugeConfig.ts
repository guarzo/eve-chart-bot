import { COLORS } from "./common";
import type { ChartConfiguration } from "chart.js";
import { getThemeSettings, getThemeColors } from "./theme";

export const KDRatioGaugeConfig: ChartConfiguration<"doughnut"> = {
  type: "doughnut",
  data: {
    labels: ["K/D Ratio"],
    datasets: [
      {
        data: [0], // Will be populated with K/D ratio
        backgroundColor: [
          getThemeColors()[0], // Main color
          getThemeSettings().grid, // Background color
        ],
        borderColor: getThemeSettings().border,
        borderWidth: 1,
        circumference: 180, // Half circle
        rotation: 270, // Start from top
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "80%",
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
      datalabels: {
        color: getThemeSettings().text,
        font: {
          size: 24,
          weight: "bold",
        },
        formatter: (value: number) => {
          return value.toFixed(2);
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 5, // Maximum K/D ratio to display
        ticks: {
          display: false,
        },
        grid: {
          display: false,
        },
        pointLabels: {
          display: false,
        },
      },
    },
  },
};

export const EfficiencyBulletConfig: ChartConfiguration<"bar"> = {
  type: "bar",
  data: {
    labels: ["Efficiency"],
    datasets: [
      {
        label: "Current",
        data: [0], // Will be populated with efficiency percentage
        backgroundColor: COLORS[1],
      },
      {
        label: "Target",
        data: [100], // Will be populated with target efficiency
        backgroundColor: COLORS[2] + "40", // semi-transparent
        borderColor: COLORS[2],
        borderWidth: 1,
      },
    ],
  },
  options: {
    indexAxis: "y",
    scales: {
      x: {
        min: 0,
        max: 100,
        title: { display: true, text: "Efficiency %" },
      },
    },
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (ctx.dataset.label === "Current") {
              return `Current: ${ctx.parsed.x}%`;
            }
            return `Target: ${ctx.parsed.x}%`;
          },
        },
      },
    },
  },
};
