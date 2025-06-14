import { ChartOptions } from '../../../types/chart';

/**
 * Configuration for Ship Types charts
 */
export const ShipTypesChartConfig = {
  title: 'Ship Types Destroyed',
  description: 'Shows top ship types destroyed (by count)',

  horizontalBarOptions: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 2.5,
    plugins: {
      title: {
        display: true,
        text: 'Top Ship Types Destroyed',
        font: {
          size: 40,
          weight: 'bold',
        },
      },
      legend: {
        display: false, // Don't need legend for single dataset
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.x;
            return `${label}: ${value.toLocaleString()} ships`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Count',
          font: {
            size: 16,
          },
        },
        ticks: {
          callback: function (value: any) {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value.toString();
          },
        },
      },
      y: {
        title: {
          display: true,
          text: 'Ship Type',
          font: {
            size: 16,
          },
        },
      },
    },
  } as ChartOptions,

  verticalBarOptions: {
    indexAxis: 'x',
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 1.5,
    plugins: {
      title: {
        display: true,
        text: 'Top Ship Types Destroyed',
        font: {
          size: 40,
          weight: 'bold',
        },
      },
      legend: {
        display: false,
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value.toLocaleString()} ships`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Count',
          font: {
            size: 16,
          },
        },
        ticks: {
          callback: function (value: any) {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value.toString();
          },
        },
      },
      x: {
        title: {
          display: true,
          text: 'Ship Type',
          font: {
            size: 16,
          },
        },
      },
    },
  } as ChartOptions,

  timelineOptions: {
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 2,
    plugins: {
      title: {
        display: true,
        text: 'Ship Types Destroyed Over Time',
        font: {
          size: 40,
          weight: 'bold',
        },
      },
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value.toLocaleString()} ships`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Count',
          font: {
            size: 16,
          },
        },
        ticks: {
          callback: function (value: any) {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value.toString();
          },
        },
      },
      x: {
        title: {
          display: true,
          text: 'Date',
          font: {
            size: 16,
          },
        },
      },
    },
  } as ChartOptions,

  // Get default summary based on ship type data
  getDefaultSummary: (totalShipTypes: number, totalDestroyed: number): string => {
    return `Showing top ${totalShipTypes} ship types destroyed (${totalDestroyed.toLocaleString()} total kills)`;
  },

  // Color palette for ship types
  colors: [
    '#3366CC', // deep blue
    '#DC3912', // red
    '#FF9900', // orange
    '#109618', // green
    '#990099', // purple
    '#0099C6', // teal
    '#DD4477', // pink
    '#66AA00', // lime
    '#B82E2E', // dark red
    '#316395', // navy
  ],
};
