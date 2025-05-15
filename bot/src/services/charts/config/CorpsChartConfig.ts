import { ChartOptions } from "../../../types/chart";

/**
 * Configuration for Corps charts
 */
export const CorpsChartConfig = {
  title: "Top Enemy Corporations",
  description: "Shows horizontal bar chart of top enemy corporations",

  horizontalBarOptions: {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 2.5,
    plugins: {
      title: {
        display: true,
        text: "Top Enemy Corporations",
        font: {
          size: 40,
          weight: "bold",
        },
      },
      legend: {
        display: false, // No legend needed for single dataset
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.dataset.label || "";
            const value = context.parsed.x;
            return `${label}: ${value.toLocaleString()} kills`;
          },
        },
      },
    },
    scales: {
      x: {
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
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Corporation",
          font: {
            size: 16,
          },
        },
      },
    },
  } as ChartOptions,

  verticalBarOptions: {
    indexAxis: "x",
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 1.5,
    plugins: {
      title: {
        display: true,
        text: "Top Enemy Corporations",
        font: {
          size: 40,
          weight: "bold",
        },
      },
      legend: {
        display: false,
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
        beginAtZero: true,
        title: {
          display: true,
          text: "Corporation",
          font: {
            size: 16,
          },
        },
      },
    },
  } as ChartOptions,

  pieOptions: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: "Kill Distribution by Enemy Corporation",
        font: {
          size: 40,
          weight: "bold",
        },
      },
      legend: {
        display: true,
        position: "right",
        labels: {
          font: {
            size: 14,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.label || "";
            const value = context.raw;
            const percentage = context.parsed;
            return `${label}: ${value.toLocaleString()} kills (${(
              percentage * 100
            ).toFixed(1)}%)`;
          },
        },
      },
    },
  } as ChartOptions,

  // Get default summary based on corp kill data
  getDefaultSummary: (
    totalCorps: number,
    totalKills: number,
    topCorpName: string,
    topCorpKills: number
  ): string => {
    const topCorpPercent =
      totalKills > 0 ? ((topCorpKills / totalKills) * 100).toFixed(1) : "0";
    return `Showing top ${totalCorps} enemy corporations (${totalKills.toLocaleString()} total kills). Leading corporation: ${topCorpName} (${topCorpPercent}%)`;
  },

  // Color palette for corporations
  colors: [
    "#3366CC", // deep blue
    "#DC3912", // red
    "#FF9900", // orange
    "#109618", // green
    "#990099", // purple
    "#0099C6", // teal
    "#DD4477", // pink
    "#66AA00", // lime
    "#B82E2E", // dark red
    "#316395", // navy
    "#994499", // violet
    "#22AA99", // seafoam
    "#AAAA11", // olive
    "#6633CC", // indigo
    "#E67300", // amber
  ],
};
