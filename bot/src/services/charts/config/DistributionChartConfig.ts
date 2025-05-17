import { ChartOptions } from "../../../types/chart";

/**
 * Configuration for Distribution charts
 */
export const DistributionChartConfig = {
  title: "Kill Group Distribution",
  description:
    "Shows distribution of solo vs. small-group vs. large-group kills",

  // Define group sizes for categorization
  groupSizes: {
    solo: 1,
    smallGroup: 5, // 2-5 attackers
    mediumGroup: 15, // 6-15 attackers
    largeGroup: 50, // 16-50 attackers
    blob: Number.MAX_SAFE_INTEGER, // 51+ attackers
  },

  // Display labels for each group size
  groupLabels: {
    solo: "Solo",
    smallGroup: "Small Group (2-5)",
    mediumGroup: "Medium Group (6-15)",
    largeGroup: "Large Group (16-50)",
    blob: "Blob (51+)",
  },

  // Color scheme for each group size
  groupColors: {
    solo: "#DC3912", // red
    smallGroup: "#3366CC", // blue
    mediumGroup: "#FF9900", // orange
    largeGroup: "#109618", // green
    blob: "#990099", // purple
  },

  // Default chart options for pie chart
  pieOptions: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: "Kill Group Size Distribution",
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
            size: 16,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.label || "";
            const value = context.raw;
            const percentage = context.parsed;
            return `${label}: ${value} kills (${(percentage * 100).toFixed(
              1
            )}%)`;
          },
        },
      },
    },
  } as ChartOptions,

  // Default chart options for doughnut chart
  doughnutOptions: {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "30%",
    plugins: {
      title: {
        display: true,
        text: "Kill Group Size Distribution",
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
            size: 16,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.label || "";
            const value = context.raw;
            const percentage = context.parsed;
            return `${label}: ${value} kills (${(percentage * 100).toFixed(
              1
            )}%)`;
          },
        },
      },
    },
  } as ChartOptions,

  // Default chart options for bar chart (alternative view)
  barOptions: {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      title: {
        display: true,
        text: "Kill Group Size Distribution",
        font: {
          size: 40,
          weight: "bold",
        },
      },
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.dataset.label || "";
            const value = context.parsed.x;
            return `${label}: ${value} kills`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Number of Kills",
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
        title: {
          display: true,
          text: "Group Size",
          font: {
            size: 16,
          },
        },
      },
    },
  } as ChartOptions,

  // Get default summary based on distribution data
  getDefaultSummary: (
    totalKills: number,
    soloKills: number,
    smallGroupKills: number,
    mediumGroupKills: number,
  ): string => {
    const soloPercent =
      totalKills > 0 ? ((soloKills / totalKills) * 100).toFixed(1) : "0";
    const smallPercent =
      totalKills > 0 ? ((smallGroupKills / totalKills) * 100).toFixed(1) : "0";
    const mediumPercent =
      totalKills > 0 ? ((mediumGroupKills / totalKills) * 100).toFixed(1) : "0";

    return `${totalKills.toLocaleString()} total kills: ${soloPercent}% solo, ${smallPercent}% small group, ${mediumPercent}% medium group`;
  },
};
