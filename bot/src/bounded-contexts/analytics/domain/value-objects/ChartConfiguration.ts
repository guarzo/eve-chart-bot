/**
 * Chart Configuration Value Object
 * Encapsulates all configuration needed to generate a chart
 */

import { ChartType, TimePeriod } from '../../../../shared/types/common';

export class ChartConfiguration {
  constructor(
    public readonly type: ChartType,
    public readonly timePeriod: TimePeriod,
    public readonly characterIds: bigint[],
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly displayOptions: ChartDisplayOptions = new ChartDisplayOptions()
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.characterIds.length === 0) {
      throw new Error('At least one character ID is required');
    }
    
    if (this.startDate >= this.endDate) {
      throw new Error('Start date must be before end date');
    }
    
    const maxDays = this.getMaxDaysForTimePeriod();
    const daysDiff = Math.ceil((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > maxDays) {
      throw new Error(`Time range too large for ${this.timePeriod} period. Maximum: ${maxDays} days`);
    }
  }

  private getMaxDaysForTimePeriod(): number {
    switch (this.timePeriod) {
      case TimePeriod.HOUR: return 7;
      case TimePeriod.DAY: return 90;
      case TimePeriod.WEEK: return 365;
      case TimePeriod.MONTH: return 730;
      case TimePeriod.QUARTER: return 1095;
      case TimePeriod.YEAR: return 1825;
      default: return 90;
    }
  }

  public equals(other: ChartConfiguration): boolean {
    return (
      this.type === other.type &&
      this.timePeriod === other.timePeriod &&
      this.characterIds.length === other.characterIds.length &&
      this.characterIds.every((id, index) => id === other.characterIds[index]) &&
      this.startDate.getTime() === other.startDate.getTime() &&
      this.endDate.getTime() === other.endDate.getTime() &&
      this.displayOptions.equals(other.displayOptions)
    );
  }

  public getCacheKey(): string {
    const characterIdsStr = this.characterIds.map(id => id.toString()).sort().join(',');
    const startDateStr = this.startDate.toISOString();
    const endDateStr = this.endDate.toISOString();
    
    return `chart:${this.type}:${this.timePeriod}:${characterIdsStr}:${startDateStr}:${endDateStr}:${this.displayOptions.getCacheKey()}`;
  }
}

export class ChartDisplayOptions {
  constructor(
    public readonly width: number = 800,
    public readonly height: number = 600,
    public readonly showLegend: boolean = true,
    public readonly showGrid: boolean = true,
    public readonly backgroundColor: string = '#ffffff',
    public readonly theme: ChartTheme = ChartTheme.LIGHT,
    public readonly showSoloKills?: boolean,
    public readonly showNpcKills?: boolean,
    public readonly showIskValue?: boolean,
    public readonly showHighValueLosses?: boolean,
    public readonly showKillLossCounts?: boolean,
    // Extended options for new processors
    public readonly limit?: number,
    public readonly analysisType?: string,
    public readonly distributionType?: string,
    public readonly heatmapType?: string,
    public readonly granularity?: string,
    public readonly showEfficiency?: boolean
  ) {}

  public equals(other: ChartDisplayOptions): boolean {
    return (
      this.width === other.width &&
      this.height === other.height &&
      this.showLegend === other.showLegend &&
      this.showGrid === other.showGrid &&
      this.backgroundColor === other.backgroundColor &&
      this.theme === other.theme
    );
  }

  public getCacheKey(): string {
    return `${this.width}x${this.height}:${this.showLegend}:${this.showGrid}:${this.backgroundColor}:${this.theme}`;
  }
}

export enum ChartTheme {
  LIGHT = 'light',
  DARK = 'dark',
  EVE = 'eve'
}