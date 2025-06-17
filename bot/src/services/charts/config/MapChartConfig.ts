import { ChartOptions } from '../../../types/chart';
import { theme } from './theme';

/**
 * Configuration for Map Activity charts
 */
export const MapChartConfig: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      stacked: true,
      title: {
        display: true,
        text: 'Count',
      },
      grid: {
        color: theme.grid.color,
      },
    },
    y: {
      stacked: true,
      title: {
        display: true,
        text: 'Character Group',
      },
      grid: {
        color: theme.grid.color,
      },
    },
  },
  plugins: {
    title: {
      display: true,
      text: 'Map Activity by Group',
      font: {
        size: theme.text.font.size.large,
        weight: theme.text.font.weight.bold,
      },
    },
    legend: {
      display: true,
      position: 'top',
      labels: {
        color: theme.text.primary,
        usePointStyle: true,
      },
    },
  },
};
