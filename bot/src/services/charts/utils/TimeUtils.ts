import { format } from 'date-fns';

/**
 * Utilities for time-related chart operations
 */
export class TimeUtils {
  /**
   * Get date format string based on group by period
   * @param groupBy The time grouping
   * @returns A date-fns format string
   */
  static getGroupByFormat(groupBy: 'hour' | 'day' | 'week'): string {
    switch (groupBy) {
      case 'hour':
        return 'HH:mm';
      case 'week':
        return 'MMM dd';
      default:
        return 'MMM dd';
    }
  }

  /**
   * Format a time range as a string
   * @param start Start date
   * @param end End date
   * @returns Formatted date range string
   */
  static formatTimeRange(start: Date, end: Date): string {
    return `${format(start, 'yyyy-MM-dd')} to ${format(end, 'yyyy-MM-dd')}`;
  }

  /**
   * Create time buckets for a date range
   * @param startDate Start date
   * @param endDate End date
   * @param groupBy Time grouping
   * @returns Array of date objects with formatted labels
   */
  static createTimeBuckets(
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'day' | 'week' = 'day'
  ): Array<{ date: Date; label: string }> {
    const result: Array<{ date: Date; label: string }> = [];
    const formatStr = this.getGroupByFormat(groupBy);
    let current = new Date(startDate);

    // Determine increment based on groupBy
    const getNextDate = (date: Date): Date => {
      const next = new Date(date);
      switch (groupBy) {
        case 'hour':
          next.setHours(next.getHours() + 1);
          break;
        case 'week':
          next.setDate(next.getDate() + 7);
          break;
        case 'day':
        default:
          next.setDate(next.getDate() + 1);
          break;
      }
      return next;
    };

    // Generate all time buckets in the range
    while (current <= endDate) {
      result.push({
        date: new Date(current),
        label: format(current, formatStr),
      });
      current = getNextDate(current);
    }

    return result;
  }
}
