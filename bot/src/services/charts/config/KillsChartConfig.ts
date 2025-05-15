import { ChartOptions } from "../../../types/chart";

/**
 * Configuration for Kills charts
 */
export const KillsChartConfig = {
  title: "Kills by Character Group",
  metrics: [
    { name: "Total Kills", field: "totalKills", color: "#3366CC" },
    { name: "Solo Kills", field: "soloKills", color: "#DC3912" },
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
          stacked: true,
          title: {
            display: true,
            text: "Count",
          },
        },
        y: {
          stacked: true,
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
          stacked: true,
          title: {
            display: true,
            text: "Character Group",
          },
        },
        y: {
          stacked: true,
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
            text: "Kills",
          },
        },
      },
    } as ChartOptions,
  },
  getDefaultSummary: (totalKills: number, soloKills: number) => {
    return `Total kills: ${totalKills.toLocaleString()}\nSolo kills: ${soloKills.toLocaleString()} (${
      totalKills > 0 ? Math.round((soloKills / totalKills) * 100) : 0
    }%)`;
  },
};
