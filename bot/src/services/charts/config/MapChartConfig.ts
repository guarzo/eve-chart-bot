import { ChartOptions } from "../../../types/chart";

/**
 * Configuration for Map Activity charts
 */
export const MapChartConfig = {
  title: "Map Activity by Character Group",
  metrics: [
    { name: "Systems Visited", field: "systems", color: "#3366CC" },
    { name: "Signatures Scanned", field: "signatures", color: "#109618" },
  ],
  options: {
    horizontal: {
      indexAxis: "y" as "x" | "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const label = context.dataset.label || "";
              const value = context.parsed.x;
              return `${label}: ${value.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: false,
          title: {
            display: true,
            text: "Count",
          },
        },
        y: {
          stacked: false,
          beginAtZero: true,
          title: {
            display: true,
            text: "Character Group",
          },
        },
      },
    } as ChartOptions,
    vertical: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const label = context.dataset.label || "";
              const value = context.parsed.y;
              return `${label}: ${value.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: false,
          title: {
            display: true,
            text: "Character Group",
          },
        },
        y: {
          stacked: false,
          beginAtZero: true,
          title: {
            display: true,
            text: "Count",
          },
        },
      },
    } as ChartOptions,
    timeline: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const label = context.dataset.label || "";
              const value = context.parsed.y;
              return `${label}: ${value.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "time" as const,
          time: {
            unit: "day" as const,
            displayFormats: {
              hour: "HH:mm",
              day: "MMM dd",
              week: "MMM dd",
            },
          },
          title: {
            display: true,
            text: "Time",
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Count",
          },
        },
      },
    } as ChartOptions,
  },
  getDefaultSummary: (totalSystems: number, totalSignatures: number) => {
    return `Total systems visited: ${totalSystems.toLocaleString()}\nTotal signatures scanned: ${totalSignatures.toLocaleString()}\nAverage signatures per system: ${
      totalSystems > 0 ? (totalSignatures / totalSystems).toFixed(1) : "0"
    }`;
  },
};
