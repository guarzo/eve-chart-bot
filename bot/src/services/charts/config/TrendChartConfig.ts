import { ChartOptions } from "../../../types/chart";

/**
 * Configuration for Trend charts
 */
export const TrendChartConfig = {
  title: "Kill Activity Trends",
  description: "Shows kills over time with trend analysis",

  timelineOptions: {
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 2,
    plugins: {
      title: {
        display: true,
        text: "Kill Activity Over Time",
        font: {
          size: 40,
          weight: "bold",
        },
      },
      legend: {
        display: true,
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.dataset.label || "";
            const value = context.parsed.y;
            return `${label}: ${value.toLocaleString()} kills`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Kill Count",
          font: {
            size: 16,
          },
        },
        ticks: {
          callback: function (value: any) {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
            if (value >= 1000) return (value / 1000).toFixed(1) + "K";
            return value.toString();
          },
        },
      },
      x: {
        title: {
          display: true,
          text: "Date",
          font: {
            size: 16,
          },
        },
        type: "time",
        time: {
          unit: "day",
          displayFormats: {
            hour: "HH:mm",
            day: "MMM d",
            week: "MMM d",
            month: "MMM yyyy",
          },
        },
      },
    },
  } as ChartOptions,

  dualAxisOptions: {
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 2,
    plugins: {
      title: {
        display: true,
        text: "Kills vs. Value Over Time",
        font: {
          size: 40,
          weight: "bold",
        },
      },
      legend: {
        display: true,
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.dataset.label || "";
            const value = context.parsed.y;
            if (context.dataset.yAxisID === "y1") {
              return `${label}: ${value.toLocaleString()} kills`;
            } else {
              return `${label}: ${value.toLocaleString()} ISK`;
            }
          },
        },
      },
    },
    scales: {
      y1: {
        type: "linear",
        display: true,
        position: "left",
        beginAtZero: true,
        title: {
          display: true,
          text: "Kill Count",
          font: {
            size: 16,
          },
        },
        ticks: {
          callback: function (value: any) {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
            if (value >= 1000) return (value / 1000).toFixed(1) + "K";
            return value.toString();
          },
        },
      },
      y2: {
        type: "linear",
        display: true,
        position: "right",
        beginAtZero: true,
        title: {
          display: true,
          text: "ISK Value",
          font: {
            size: 16,
          },
        },
        grid: {
          drawOnChartArea: false, // only want the grid lines for y1 axis
        },
        ticks: {
          callback: function (value: any) {
            if (value >= 1000000000)
              return (value / 1000000000).toFixed(1) + "B";
            if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
            if (value >= 1000) return (value / 1000).toFixed(1) + "K";
            return value.toString();
          },
        },
      },
      x: {
        title: {
          display: true,
          text: "Date",
          font: {
            size: 16,
          },
        },
        type: "time",
        time: {
          unit: "day",
          displayFormats: {
            hour: "HH:mm",
            day: "MMM d",
            week: "MMM d",
            month: "MMM yyyy",
          },
        },
      },
    },
  } as ChartOptions,

  areaOptions: {
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 2,
    plugins: {
      title: {
        display: true,
        text: "Cumulative Kills Over Time",
        font: {
          size: 40,
          weight: "bold",
        },
      },
      legend: {
        display: true,
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.dataset.label || "";
            const value = context.parsed.y;
            return `${label}: ${value.toLocaleString()} total kills`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Cumulative Kills",
          font: {
            size: 16,
          },
        },
        ticks: {
          callback: function (value: any) {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
            if (value >= 1000) return (value / 1000).toFixed(1) + "K";
            return value.toString();
          },
        },
      },
      x: {
        title: {
          display: true,
          text: "Date",
          font: {
            size: 16,
          },
        },
        type: "time",
        time: {
          unit: "day",
          displayFormats: {
            hour: "HH:mm",
            day: "MMM d",
            week: "MMM d",
            month: "MMM yyyy",
          },
        },
      },
    },
  } as ChartOptions,

  // Get default summary based on trend data
  getDefaultSummary: (
    totalKills: number,
    startDate: Date,
    endDate: Date,
    averageKillsPerDay: number,
    trend: "increasing" | "stable" | "decreasing"
  ): string => {
    const dayCount = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const trendText =
      trend === "increasing"
        ? "increasing trend"
        : trend === "decreasing"
        ? "decreasing trend"
        : "stable trend";

    return `${totalKills.toLocaleString()} kills over ${dayCount} days (avg: ${averageKillsPerDay.toFixed(
      1
    )}/day) with ${trendText}`;
  },

  // Color palette for trend lines
  colors: [
    "#3366CC", // deep blue
    "#DC3912", // red
    "#FF9900", // orange
    "#109618", // green
    "#990099", // purple
  ],
};
