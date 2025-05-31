import Chart from "chart.js/auto";
import { DoughnutController, ArcElement, Tooltip } from "chart.js";
import type { ChartConfiguration } from "chart.js";
import { chartPalette } from "./theme";

// Register doughnut + tooltip
Chart.register(DoughnutController, ArcElement, Tooltip);

// These will be filled in by the generator
const characterNames: string[] = [];
const efficiencyPercents: number[] = [];

export const EfficiencyGaugeConfig: ChartConfiguration<"doughnut"> = {
  type: "doughnut",
  data: {
    labels: characterNames,
    datasets: [
      {
        // filled portion = efficiency, empty = remainder
        data: efficiencyPercents.map((p) => [p, 100 - p]).flat(),
        backgroundColor: efficiencyPercents.flatMap((_p, _i) => [
          chartPalette[2],
          "rgba(255,255,255,0.1)",
        ]),
        borderWidth: 0,
      },
    ],
  },
  options: {
    rotation: -Math.PI,
    circumference: Math.PI,
    cutout: "70%",
    plugins: {
      legend: { display: false },
    },
  },
};
