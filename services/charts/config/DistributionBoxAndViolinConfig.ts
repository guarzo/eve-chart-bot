import type { ChartConfiguration } from "chart.js";
import { getThemeSettings, getThemeColors } from "./theme";

export const DistributionBoxPlotConfig: ChartConfiguration<"boxplot"> = {
  type: "boxplot",
  data: {
    labels: [], // Will be populated with bucket labels
    datasets: [
      {
        label: "Group-size distribution",
        data: [], // Will be populated with raw attacker counts
        backgroundColor: getThemeColors()[2] + "80", // semi‐transparent fill
        borderColor: getThemeColors()[2],
        borderWidth: 1,
        itemRadius: 2,
      },
    ],
  },
  options: {
    plugins: {
      legend: {
        display: false,
        labels: {
          color: getThemeSettings().text,
        },
      },
      tooltip: {
        callbacks: {
          // Show quartiles and outliers
          label: (ctx) => {
            const d = ctx.raw as any;
            return [
              `Min: ${d.min}`,
              `Q1: ${d.q1}`,
              `Median: ${d.median}`,
              `Q3: ${d.q3}`,
              `Max: ${d.max}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Number of Attackers",
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
        title: {
          display: true,
          text: "Kills per Bucket",
          color: getThemeSettings().text,
        },
        beginAtZero: true,
        grid: {
          color: getThemeSettings().grid,
        },
        ticks: {
          color: getThemeSettings().text,
        },
      },
    },
  },
};

export const DistributionViolinConfig: ChartConfiguration<"violin"> = {
  type: "violin",
  data: {
    labels: [], // Will be populated with bucket labels
    datasets: [
      {
        label: "Group-size density",
        data: [], // Will be populated with raw attacker counts
        backgroundColor: getThemeColors()[3] + "80",
        borderColor: getThemeColors()[3],
        borderWidth: 1,
        side: "both", // full symmetrical violin
      },
    ],
  },
  options: {
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: getThemeSettings().text,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            // Show estimated density at that violin slice
            return `Density: ${ctx.parsed.y.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Number of Attackers",
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
        title: {
          display: true,
          text: "Density",
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
  },
};
