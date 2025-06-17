import { ChartOptions } from '../../../types/chart';

/**
 * Configuration for Loss charts
 */
export const LossChartConfig = {
  title: 'Losses by Character Group',
  metrics: [
    { name: 'Total Losses', field: 'totalLosses', color: '#DC3912' },
    { name: 'High Value Losses', field: 'highValueLosses', color: '#FF9900' },
  ],
  options: {
    horizontal: {
      indexAxis: 'y' as 'x' | 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const label = context.dataset.label || '';
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
            text: 'Count',
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Character Group',
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
          position: 'top' as const,
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const label = context.dataset.label || '';
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
            text: 'Character Group',
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Count',
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
          position: 'top' as const,
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              return `${label}: ${value.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time' as const,
          time: {
            unit: 'day' as const,
            displayFormats: {
              hour: 'HH:mm',
              day: 'MMM dd',
              week: 'MMM dd',
            },
          },
          title: {
            display: true,
            text: 'Time',
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Losses',
          },
        },
      },
    } as ChartOptions,
  },
  getDefaultSummary: (totalLosses: number, highValueLosses: number, totalIskLost: string) => {
    return `Total ship losses: ${totalLosses.toLocaleString()}\nHigh-value losses: ${highValueLosses.toLocaleString()} (${
      totalLosses > 0 ? Math.round((highValueLosses / totalLosses) * 100) : 0
    }%)\nTotal ISK lost: ${totalIskLost}`;
  },
};
