import { ChartData, ChartDisplayType } from '../../../types/chart';

/**
 * Utilities for creating chart layouts
 */
export class ChartLayoutUtils {
  /**
   * Create a horizontal bar chart layout
   * @param labels The chart labels
   * @param datasets The chart datasets
   * @param title The chart title
   * @returns A configured chart data object
   */
  static createHorizontalBarLayout(
    labels: string[],
    datasets: { label: string; data: number[]; backgroundColor: string }[],
    title: string
  ): ChartData {
    return {
      labels,
      datasets,
      displayType: 'horizontalBar',
      options: {
        indexAxis: 'y',
        scales: { x: { beginAtZero: true }, y: { stacked: true } },
        plugins: {
          title: { display: true, text: title },
          legend: { position: 'top' },
        },
      },
    };
  }

  /**
   * Create a vertical bar chart layout
   * @param labels The chart labels
   * @param datasets The chart datasets
   * @param title The chart title
   * @returns A configured chart data object
   */
  static createVerticalBarLayout(
    labels: string[],
    datasets: { label: string; data: number[]; backgroundColor: string }[],
    title: string
  ): ChartData {
    return {
      labels,
      datasets,
      displayType: 'bar',
      options: {
        scales: { y: { beginAtZero: true } },
        plugins: {
          title: { display: true, text: title },
          legend: { position: 'top' },
        },
      },
    };
  }

  /**
   * Create a line chart layout
   * @param labels The chart labels
   * @param datasets The chart datasets
   * @param title The chart title
   * @returns A configured chart data object
   */
  static createLineLayout(
    labels: string[],
    datasets: {
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor?: string;
    }[],
    title: string
  ): ChartData {
    return {
      labels,
      datasets,
      displayType: 'line',
      options: {
        scales: { y: { beginAtZero: true } },
        plugins: {
          title: { display: true, text: title },
          legend: { position: 'top' },
        },
      },
    };
  }

  /**
   * Create a pie chart layout
   * @param labels The chart labels
   * @param data The chart data values
   * @param backgroundColor Background colors for each slice
   * @param title The chart title
   * @returns A configured chart data object
   */
  static createPieLayout(labels: string[], data: number[], backgroundColor: string[], title: string): ChartData {
    return {
      labels,
      datasets: [
        {
          label: title,
          data,
          backgroundColor,
        },
      ],
      displayType: 'pie',
      options: {
        plugins: {
          title: { display: true, text: title },
          legend: { position: 'top' },
        },
      },
    };
  }
}
