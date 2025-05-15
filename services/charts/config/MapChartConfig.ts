import { ChartData } from "../../../types/chart";
import { theme } from "./theme";

export const MapChartConfig = {
  options: {
    horizontal: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y" as const,
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
          title: {
            display: true,
            text: "Character Group",
          },
        },
      },
      plugins: {
        title: {
          display: true,
          text: "Map Activity by Group",
          font: {
            size: 16,
            weight: "bold",
          },
        },
        legend: {
          display: true,
          position: "top",
          labels: {
            usePointStyle: true,
            color: theme.text.primary,
          },
        },
      },
    },
    vertical: {
      responsive: true,
      maintainAspectRatio: false,
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
          title: {
            display: true,
            text: "Count",
          },
        },
      },
      plugins: {
        title: {
          display: true,
          text: "Map Activity by Group",
          font: {
            size: 16,
            weight: "bold",
          },
        },
        legend: {
          display: true,
          position: "top",
          labels: {
            usePointStyle: true,
            color: theme.text.primary,
          },
        },
      },
    },
    timeline: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "time",
          time: {
            unit: "day",
            displayFormats: {
              day: "MMM d",
            },
          },
          title: {
            display: true,
            text: "Date",
          },
        },
        y: {
          title: {
            display: true,
            text: "Count",
          },
        },
      },
      plugins: {
        title: {
          display: true,
          text: "Map Activity Over Time",
          font: {
            size: 16,
            weight: "bold",
          },
        },
        legend: {
          display: true,
          position: "top",
          labels: {
            usePointStyle: true,
            color: theme.text.primary,
          },
        },
      },
    },
  },
};
