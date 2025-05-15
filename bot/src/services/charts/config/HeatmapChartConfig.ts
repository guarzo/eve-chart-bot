import { ChartOptions } from "../../../types/chart";

/**
 * Configuration for Heatmap charts
 */
export const HeatmapChartConfig = {
  title: "Kill Activity Heatmap",
  description: "Shows heatmap of kill activity by hour and day of week",

  // Options for the basic heatmap view
  heatmapOptions: {
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 1.5,
    plugins: {
      title: {
        display: true,
        text: "Kill Activity by Time of Day",
        font: {
          size: 40,
          weight: "bold",
        },
      },
      legend: {
        display: true,
        position: "right",
        align: "center",
        labels: {
          boxWidth: 20,
          font: {
            size: 14,
          },
        },
      },
      tooltip: {
        callbacks: {
          title: (ctx: any) => {
            const dayName = ctx[0].label;
            const hour = ctx[0].dataset.label;
            return `${dayName} at ${hour}`;
          },
          label: (ctx: any) => {
            const value = ctx.raw;
            return `${value} kills`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Day of Week",
          font: {
            size: 16,
            weight: "bold",
          },
        },
        grid: {
          display: true,
          color: "rgba(0, 0, 0, 0.1)",
        },
      },
      y: {
        title: {
          display: true,
          text: "Hour of Day",
          font: {
            size: 16,
            weight: "bold",
          },
        },
        grid: {
          display: true,
          color: "rgba(0, 0, 0, 0.1)",
        },
      },
    },
  } as ChartOptions,

  // Options for the calendar style view
  calendarOptions: {
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 1.7,
    plugins: {
      title: {
        display: true,
        text: "Calendar View of Kill Activity",
        font: {
          size: 40,
          weight: "bold",
        },
      },
      legend: {
        display: true,
        position: "right",
        align: "center",
        labels: {
          boxWidth: 20,
          font: {
            size: 14,
          },
        },
      },
      tooltip: {
        callbacks: {
          title: (ctx: any) => {
            return ctx[0].dataset.data[ctx[0].dataIndex].date;
          },
          label: (ctx: any) => {
            return `${ctx.raw.v} kills`;
          },
        },
      },
    },
  } as ChartOptions,

  // Days of the week for labels
  daysOfWeek: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],

  // Short days of the week for labels
  shortDaysOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],

  // Hour labels (24-hour format)
  hours: Array.from({ length: 24 }, (_, i) =>
    i < 10 ? `0${i}:00` : `${i}:00`
  ),

  // Color gradient for heatmap (from low to high activity)
  colorGradient: [
    "#EBEDF0", // very low
    "#9BE9A8", // low
    "#40C463", // medium
    "#30A14E", // high
    "#216E39", // very high
  ],

  // Get default summary based on heatmap data
  getDefaultSummary: (
    totalKills: number,
    peakDay: string,
    peakHour: string,
    peakKills: number
  ): string => {
    const peakPercent =
      totalKills > 0 ? ((peakKills / totalKills) * 100).toFixed(1) : "0";
    return `${totalKills.toLocaleString()} total kills. Peak activity: ${peakDay} at ${peakHour} (${peakKills} kills, ${peakPercent}% of total)`;
  },
};
