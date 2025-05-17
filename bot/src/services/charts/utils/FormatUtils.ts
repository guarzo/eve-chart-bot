/**
 * Utilities for formatting chart values for display
 */
export class FormatUtils {
  /**
   * Format a numeric value with appropriate suffix (K, M, B)
   * @param value The numeric value to format
   * @returns Formatted string with suffix
   */
  static formatValue(value: number): string {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    } else if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    } else if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    } else {
      return value.toString();
    }
  }

  /**
   * Format a BigInt value with appropriate suffix
   * @param value The BigInt value to format
   * @returns Formatted string with suffix
   */
  static formatBigIntValue(value: bigint): string {
    return this.formatValue(Number(value.toString()));
  }

  /**
   * Format an ISK (EVE currency) value with appropriate suffix
   * @param value The ISK amount as BigInt
   * @returns Formatted string with ISK suffix
   */
  static formatIsk(value: bigint): string {
    const n = Number(value);
    if (n >= 1_000_000_000_000) {
      return `${(n / 1_000_000_000_000).toFixed(2)}T`;
    } else if (n >= 1_000_000_000) {
      return `${(n / 1_000_000_000).toFixed(2)}B`;
    } else if (n >= 1_000_000) {
      return `${(n / 1_000_000).toFixed(2)}M`;
    } else if (n >= 1_000) {
      return `${(n / 1_000).toFixed(2)}K`;
    } else {
      return n.toString();
    }
  }
}
