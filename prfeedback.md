# Chart Improvements Feedback

## 1. Use More Appropriate Chart Types

| Current                                                             | Suggested                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distribution: horizontal bar of attacker-counts per kill (1, 2, 3…) | Histogram: group raw attackerCount into buckets and show a true histogram (with bars touching) to emphasize the shape of the distribution. You can even overlay a kernel density estimate or a simple violin plot (via the Chart.js boxplot/violin plugin). |
| Kills / Solo Kills: two separate bars per character                 | Stacked bar: combine "Total" and "Solo" into one bar per character, with "Solo" as a segment of the whole. That immediately shows who's running the highest solo-kill ratio, and reduces clutter.                                                           |
| Losses: single bar of ISK lost per character                        | Dual-axis bar + scatter: use a left-axis bar for "total losses," a right-axis line (or scatter) for "ISK lost." That lets you see characters who lose few ships but at very high ISK cost (or vice versa).                                                  |
| Map activity: static bars for "systems" and "signatures"            | Time-series line/area: since you already bucket by date, a time axis (line chart) for each group shows trends—e.g. ramp-ups in scanning. You could even stack them as an area chart to compare overall activity.                                            |
| K/D Ratio: two bars (ratio & efficiency)                            | Gauge or bullet chart: a radial gauge for K/D and a separate bullet chart for "% efficiency" can be more intuitive than plain bars. Chart.js has gauge plugins, or you can fake it with a doughnut chart.                                                   |

## 2. Adopt a Cohesive, Color-Blind–Friendly Palette

Pick one of the popular palettes (e.g. ColorBrewer "Set2" or "Paired") and define it once:

```typescript
// services/charts/config/common.ts
export const COLORS = [
  "#1b9e77",
  "#d95f02",
  "#7570b3",
  "#e7298a",
  "#66a61e",
  "#e6ab02",
  "#a6761d",
  "#666666",
];
```

Then in each chart config use `backgroundColor: COLORS.slice(0, labels.length)` and `borderColor: ...`

**Dark-mode tip:** If you render on a dark background, lighten your palette by 20% (you can use TinyColor or just pick lighter hexes) and ensure your gridlines/text are high-contrast (e.g. #fff for labels, rgba(255,255,255,0.2) for grids).

## 3. Improve Labeling & Interactivity

- **Axis titles & units:** e.g. "ISK Lost (millions)", "Kills per Day", etc.
- **Legend placement:** move to the top center, or hide it if you only have one series.

## 4. Leverage Chart.js Plugins

- **Heatmap:** for your "time-of-day / day-of-week" chart, use chartjs-chart-matrix to draw a true 7×24 heatmap instead of 168 tiny bars.
- **Box & Violin:** for distribution, use chartjs-chart-boxplot for boxplots or violins.
- **Annotations:** chartjs-plugin-annotation to draw threshold lines (e.g. "high-value loss" cut-off).

## 5. Concrete Config Tweaks

### Distribution Chart Example

```typescript
import { COLORS } from "./common";
import type { ChartOptions } from "./types";

export const DistributionChartConfig: ChartOptions = {
  type: "bar",
  data: {
    labels: buckets, // e.g. ["1", "2–3", "4–5", "6+"]
    datasets: [
      {
        label: "Attacker Count",
        data: bucketCounts,
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
```

### Kills Chart Example (Stacked Bar)

```typescript
export const KillsChartConfig = {
  type: "bar",
  data: {
    labels: characterNames,
    datasets: [
      {
        label: "Solo Kills",
        data: soloKills,
        backgroundColor: COLORS[0],
      },
      {
        label: "Group Kills",
        data: totalKills.map((t, i) => t - soloKills[i]),
        backgroundColor: COLORS[1],
      },
    ],
  },
  options: {
    indexAxis: "y",
    scales: {
      x: { stacked: true, title: { text: "Kills", display: true } },
      y: { stacked: true },
    },
    plugins: { tooltip: { mode: "index" }, legend: { position: "top" } },
  },
};
```

## 6. Next Steps

1. Define a single palette in `.../config/common.ts` and import it everywhere.
2. Swap out your plain bar configs for the examples above.
3. Install any needed plugins (boxplot, matrix, datalabels).
4. Double-check contrast on your dark background.

With those changes you'll have charts that:

- Tell the right story (histograms for distributions, stacked bars for composition, lines/areas for trends)
- Look cohesive (one palette, consistent styling)
- Are easier to read at a glance (clear axes, annotations, interactive tooltips)

## Example Implementations

### Distribution Box and Violin Chart

```typescript
// services/charts/config/DistributionBoxAndViolinConfig.ts

import Chart from "chart.js/auto";
import {
  BoxPlotController,
  ViolinController,
  BoxAndViolinDataPoint,
} from "chartjs-chart-boxplot";
import type { ChartConfiguration } from "chart.js";
import { COLORS } from "./common";

// Register the boxplot & violin controllers
Chart.register(BoxPlotController, ViolinController);

/**
 * Example raw data: each entry is an array of attacker‐counts per kill
 * e.g. [[1,1,1,2,2,3,...], [4,5,4,6,...], ...]
 */
const rawAttackerBuckets: BoxAndViolinDataPoint[][] = getYourRawAttackerData();

/**
 * Labels for each "bucket" (e.g. single players, small gangs, fleets…)
 * Must align 1:1 with rawAttackerBuckets.
 */
const bucketLabels: string[] = ["1", "2–3", "4–5", "6+"];

/**
 * BOXPLOT CONFIG
 */
export const DistributionBoxPlotConfig: ChartConfiguration<"boxplot"> = {
  type: "boxplot",
  data: {
    labels: bucketLabels,
    datasets: [
      {
        label: "Group-size distribution",
        data: rawAttackerBuckets,
        backgroundColor: COLORS[2] + "80", // semi‐transparent fill
        borderColor: COLORS[2],
        borderWidth: 1,
        itemRadius: 2,
      },
    ],
  },
  options: {
    plugins: {
      legend: { display: false },
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
        title: { display: true, text: "Number of Attackers" },
      },
      y: {
        title: { display: true, text: "Kills per Bucket" },
        beginAtZero: true,
      },
    },
  },
};

/**
 * VIOLIN CONFIG
 */
export const DistributionViolinConfig: ChartConfiguration<"violin"> = {
  type: "violin",
  data: {
    labels: bucketLabels,
    datasets: [
      {
        label: "Group-size density",
        data: rawAttackerBuckets,
        backgroundColor: COLORS[3] + "80",
        borderColor: COLORS[3],
        borderWidth: 1,
        side: "both", // full symmetrical violin
      },
    ],
  },
  options: {
    plugins: {
      legend: { position: "top" },
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
      x: { title: { display: true, text: "Number of Attackers" } },
      y: { title: { display: true, text: "Density" } },
    },
  },
};
```

### Time of Day Heatmap

```typescript
// services/charts/config/TimeOfDayHeatmapConfig.ts

import Chart from "chart.js/auto";
import { MatrixController, MatrixElement } from "chartjs-chart-matrix";
import type { ChartConfiguration } from "chart.js";
import { COLORS } from "./common";

// Register the matrix (heatmap) controller and element
Chart.register(MatrixController, MatrixElement);

/**
 * Your input: an array of objects { x: hour, y: weekday, v: count }
 * - x: 0–23
 * - y: 0–6 (Sunday=0 … Saturday=6)
 * - v: number of kills in that hour/day
 */
const heatmapData = generateHourlyHeatmapCounts();

/**
 * Simple linear color scale: light → dark
 */
function getColorForValue(v: number): string {
  const max = findMaxValue(heatmapData);
  const alpha = Math.min(1, v / max);
  return Chart.helpers.color(COLORS[4]).alpha(alpha).rgbString();
}

export const TimeOfDayHeatmapConfig: ChartConfiguration<"matrix"> = {
  type: "matrix",
  data: {
    datasets: [
      {
        label: "Kills by Hour / Weekday",
        data: heatmapData,
        backgroundColor(ctx) {
          return getColorForValue(ctx.dataset.data[ctx.dataIndex].v);
        },
        width: ({ chart }) => chart.chartArea.width / 24 - 1,
        height: ({ chart }) => chart.chartArea.height / 7 - 1,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.1)",
      },
    ],
  },
  options: {
    maintainAspectRatio: false,
    scales: {
      x: {
        type: "category",
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        title: { display: true, text: "Hour of Day (UTC)" },
      },
      y: {
        type: "category",
        labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        title: { display: true, text: "Weekday" },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: ([ctx]) => {
            const { x, y } = ctx.raw as any;
            return `Day: ${ctx.chart.data.datasets[0].data[y].y}, Hour: ${x}:00`;
          },
          label: (ctx) => {
            const { v } = ctx.raw as any;
            return ` ${v} kills`;
          },
        },
      },
    },
  },
};
```

### Loss Chart Improvement

```typescript
// services/charts/config/LossChartConfig.ts

import Chart from "chart.js/auto";
import type { ChartConfiguration } from "chart.js";
import { COLORS } from "./common";

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
        backgroundColor: COLORS[0],
        borderColor: COLORS[0],
        borderWidth: 1,
        yAxisID: "lossCount",
      },
      {
        label: "ISK Lost (Billions)",
        data: iskLostBillions,
        type: "line", // <-- mix-in line
        backgroundColor: COLORS[1] + "33", // semi-transparent fill
        borderColor: COLORS[1],
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
        title: { display: true, text: "Character" },
        ticks: { maxRotation: 0, autoSkip: false },
      },
      lossCount: {
        type: "linear",
        position: "left",
        title: { display: true, text: "Loss Count" },
        beginAtZero: true,
      },
      iskLost: {
        type: "linear",
        position: "right",
        title: { display: true, text: "ISK Lost (Billion)" },
        beginAtZero: true,
        grid: { drawOnChartArea: false }, // only show grid on left
      },
    },
    plugins: {
      legend: {
        position: "top",
        labels: { usePointStyle: true },
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
```
