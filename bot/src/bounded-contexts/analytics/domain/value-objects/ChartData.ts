/**
 * Chart Data Value Object
 * Represents the processed data ready for chart rendering
 */

import { ChartType } from '../../../../shared/types/common';

export class ChartData {
  constructor(
    public readonly type: ChartType,
    public readonly labels: string[],
    public readonly datasets: ChartDataset[],
    public readonly metadata: ChartMetadata = new ChartMetadata()
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.datasets.length === 0) {
      throw new Error('At least one dataset is required');
    }

    // Validate that all datasets have the same number of data points as labels
    for (const dataset of this.datasets) {
      if (dataset.data.length !== this.labels.length) {
        throw new Error(
          `Dataset '${dataset.label}' data length (${dataset.data.length}) does not match labels length (${this.labels.length})`
        );
      }
    }
  }

  public getDatasetByLabel(label: string): ChartDataset | null {
    return this.datasets.find(dataset => dataset.label === label) || null;
  }

  public getTotalDataPoints(): number {
    return this.datasets.reduce((total, dataset) => total + dataset.data.length, 0);
  }

  public hasData(): boolean {
    return this.datasets.some(dataset => dataset.data.some(value => value > 0));
  }
}

export class ChartDataset {
  constructor(
    public readonly label: string,
    public readonly data: number[],
    public readonly backgroundColor: string | string[],
    public readonly borderColor?: string | string[],
    public readonly borderWidth?: number,
    public readonly fill?: boolean
  ) {}
}

export class ChartMetadata {
  constructor(
    public readonly generatedAt: Date = new Date(),
    public readonly dataPointCount: number = 0,
    public readonly processingTimeMs: number = 0,
    public readonly cacheHit: boolean = false,
    public readonly correlationId?: string
  ) {}

  public getAge(): number {
    return Date.now() - this.generatedAt.getTime();
  }

  public isStale(maxAgeMs: number): boolean {
    return this.getAge() > maxAgeMs;
  }
}
