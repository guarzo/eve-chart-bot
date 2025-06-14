import { ChartOptions } from '../../../types/chart';
import { theme } from './theme';

interface TrendChartConfigType extends ChartOptions {
  colors: string[];
  title: string;
  timelineOptions: ChartOptions;
  areaOptions: ChartOptions;
  dualAxisOptions: ChartOptions;
  getDefaultSummary: (
    totalKills: number,
    averageKillsPerDay: number,
    trend: 'increasing' | 'stable' | 'decreasing'
  ) => string;
}

export const TrendChartConfig: TrendChartConfigType = {
  responsive: true,
  maintainAspectRatio: false,
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
  title: 'Kill Trends Over Time',
  timelineOptions: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Kill Trends Over Time',
        font: {
          size: theme.text.font.size.large,
          weight: theme.text.font.weight.bold,
        },
      },
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day',
          displayFormats: {
            day: 'MMM d',
          },
        },
        title: {
          display: true,
          text: 'Date',
        },
        grid: {
          color: theme.grid.color,
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        beginAtZero: true,
        title: {
          display: true,
          text: 'Kill Count',
          font: {
            size: theme.text.font.size.medium,
          },
        },
        grid: {
          color: theme.grid.color,
        },
        ticks: {
          callback: (value: any) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value.toString();
          },
        },
      },
    },
  },
  areaOptions: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Cumulative Kills Over Time',
        font: {
          size: theme.text.font.size.large,
          weight: theme.text.font.weight.bold,
        },
      },
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day',
          displayFormats: {
            day: 'MMM d',
          },
        },
        title: {
          display: true,
          text: 'Date',
        },
        grid: {
          color: theme.grid.color,
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        beginAtZero: true,
        title: {
          display: true,
          text: 'Cumulative Kills',
          font: {
            size: theme.text.font.size.medium,
          },
        },
        grid: {
          color: theme.grid.color,
        },
        ticks: {
          callback: (value: any) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value.toString();
          },
        },
      },
    },
  },
  dualAxisOptions: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Kills vs. Value Over Time',
        font: {
          size: theme.text.font.size.large,
          weight: theme.text.font.weight.bold,
        },
      },
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (label.includes('Value')) {
              return `${label}: ${value.toFixed(1)}B ISK`;
            }
            return `${label}: ${value.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day',
          displayFormats: {
            day: 'MMM d',
          },
        },
        title: {
          display: true,
          text: 'Date',
        },
        grid: {
          color: theme.grid.color,
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        beginAtZero: true,
        title: {
          display: true,
          text: 'Kill Count',
          font: {
            size: theme.text.font.size.medium,
          },
        },
        grid: {
          color: theme.grid.color,
        },
        ticks: {
          callback: (value: any) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value.toString();
          },
        },
      },
      y2: {
        type: 'linear',
        display: true,
        position: 'right',
        beginAtZero: true,
        title: {
          display: true,
          text: 'ISK Value (Billions)',
          font: {
            size: theme.text.font.size.medium,
          },
        },
        grid: {
          color: theme.grid.color,
          drawOnChartArea: false,
        },
        ticks: {
          callback: (value: any) => {
            return `${value.toFixed(1)}B`;
          },
        },
      },
    },
  },
  getDefaultSummary: (
    totalKills: number,
    averageKillsPerDay: number,
    trend: 'increasing' | 'stable' | 'decreasing'
  ) => {
    const trendEmoji = trend === 'increasing' ? '📈' : trend === 'decreasing' ? '📉' : '➡️';
    const trendText = trend === 'increasing' ? 'increasing' : trend === 'decreasing' ? 'decreasing' : 'stable';
    return `${trendEmoji} ${totalKills.toLocaleString()} total kills (${averageKillsPerDay.toFixed(
      1
    )} per day) with ${trendText} trend`;
  },
};
