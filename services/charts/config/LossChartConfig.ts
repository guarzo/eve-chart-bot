import type { ChartConfiguration } from "chart.js";
import { getThemeSettings, getThemeColors } from "./theme";

// Example inputs (replace these with your real data arrays):
const characterNames = [
  "Me'Shell Jones",
  "Guarzo Estuven",
  "Shiv Dark",
  "Malcolm X-Type",
  "Darvious",
  "Dismas November",
  "Celaton",
  "Stantum Zateki",
  "Hellspawn8",
  "Smosh Cringe",
  "Dirty Sancheez",
];
const totalLosses = [6, 403, 4, 657, 1, 2, 3, 1, 5, 463, 667];
const iskLostRaw = [
  3910156580000, 1129504891486, 3046414270000, 906322835770, 1169851480000,
  1248390070000, 4568466780000, 2016946470000, 5024313490000, 111781052472,
  144405917490,
];

// Convert raw ISK into billions (for axis scaling)
const iskLostBillions = iskLostRaw.map((v) => +(v / 1e9).toFixed(2));

export const LossChartConfig: ChartConfiguration<"bar"> = {
  // Base type is 'bar'; we'll mix in a line dataset
  type: "bar",
  data: {
    labels: characterNames,
    datasets: [
      {
        label: "Total Losses",
        data: totalLosses,
        backgroundColor: getThemeColors()[0],
        borderColor: getThemeColors()[0],
        borderWidth: 1,
        yAxisID: "lossCount",
      },
      {
        label: "ISK Lost (Billions)",
        data: iskLostBillions,
        type: "line", // <-- mix-in line
        backgroundColor: getThemeColors()[1] + "33", // semi-transparent fill
        borderColor: getThemeColors()[1],
        borderWidth: 2,
        pointRadius: 4,
        tension: 0.3,
        yAxisID: "iskLost",
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
        title: {
          display: true,
          text: "Character",
          color: getThemeSettings().text,
        },
        ticks: {
          maxRotation: 0,
          autoSkip: false,
          color: getThemeSettings().text,
        },
        grid: {
          color: getThemeSettings().grid,
        },
      },
      lossCount: {
        type: "linear",
        position: "left",
        title: {
          display: true,
          text: "Loss Count",
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
      iskLost: {
        type: "linear",
        position: "right",
        title: {
          display: true,
          text: "ISK Lost (Billion)",
          color: getThemeSettings().text,
        },
        beginAtZero: true,
        grid: {
          drawOnChartArea: false,
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
              return ` ${ctx.parsed.y} B ISK lost`;
            }
            return ` ${ctx.parsed.y} losses`;
          },
        },
      },
    },
  },
};
