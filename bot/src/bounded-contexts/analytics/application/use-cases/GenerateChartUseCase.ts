/**
 * Generate Chart Use Case
 * Orchestrates the entire chart generation process following clean architecture principles
 */

import { ChartConfiguration } from '../../domain/value-objects/ChartConfiguration';
import { ChartData } from '../../domain/value-objects/ChartData';
import { ChartDataProcessor } from '../../domain/services/ChartDataProcessor';
import type { KillDataPoint, LossDataPoint } from '../../domain/services/ChartDataProcessor';
export type { KillDataPoint, LossDataPoint };
import { OperationResult, ChartType } from '../../../../shared/types/common';

// Repository interfaces (will be implemented in infrastructure layer)
export interface KillDataRepository {
  getKillDataForCharacters(characterIds: bigint[], startDate: Date, endDate: Date): Promise<KillDataPoint[]>;
}

export interface LossDataRepository {
  getLossDataForCharacters(characterIds: bigint[], startDate: Date, endDate: Date): Promise<LossDataPoint[]>;
}

export interface ChartCacheRepository {
  get(key: string): Promise<ChartData | null>;
  set(key: string, data: ChartData, ttlSeconds: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

export interface ChartRenderer {
  render(chartData: ChartData, config: ChartConfiguration): Promise<Buffer>;
}

export class GenerateChartUseCase {
  constructor(
    private readonly killDataRepository: KillDataRepository,
    private readonly lossDataRepository: LossDataRepository,
    private readonly chartCacheRepository: ChartCacheRepository,
    private readonly chartRenderer: ChartRenderer,
    private readonly chartDataProcessor: ChartDataProcessor = new ChartDataProcessor()
  ) {}

  async execute(config: ChartConfiguration): Promise<OperationResult<Buffer>> {
    const correlationId = this.generateCorrelationId();

    try {
      // 1. Check cache first
      const cacheKey = config.getCacheKey();
      const cachedData = await this.chartCacheRepository.get(cacheKey);

      if (cachedData && !cachedData.metadata.isStale(5 * 60 * 1000)) {
        // 5 minutes
        const renderedChart = await this.chartRenderer.render(cachedData, config);
        return {
          success: true,
          data: renderedChart,
          correlationId,
        };
      }

      // 2. Fetch raw data based on chart type
      const chartData = await this.generateChartData(config);

      // 3. Cache the processed data
      await this.chartCacheRepository.set(cacheKey, chartData, 300); // 5 minutes TTL

      // 4. Render the chart
      const renderedChart = await this.chartRenderer.render(chartData, config);

      // Processing completed successfully

      return {
        success: true,
        data: renderedChart,
        correlationId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        correlationId,
      };
    }
  }

  private async generateChartData(config: ChartConfiguration): Promise<ChartData> {
    switch (config.type) {
      case ChartType.KILLS:
        return this.generateKillChart(config);

      case ChartType.LOSSES:
        return this.generateLossChart(config);

      case ChartType.EFFICIENCY:
        return this.generateEfficiencyChart(config);

      default:
        throw new Error(`Unsupported chart type: ${config.type}`);
    }
  }

  private async generateKillChart(config: ChartConfiguration): Promise<ChartData> {
    const killData = await this.killDataRepository.getKillDataForCharacters(
      config.characterIds,
      config.startDate,
      config.endDate
    );

    return this.chartDataProcessor.processKillData(config, killData);
  }

  private async generateLossChart(config: ChartConfiguration): Promise<ChartData> {
    const lossData = await this.lossDataRepository.getLossDataForCharacters(
      config.characterIds,
      config.startDate,
      config.endDate
    );

    return this.chartDataProcessor.processLossData(config, lossData);
  }

  private async generateEfficiencyChart(config: ChartConfiguration): Promise<ChartData> {
    const [killData, lossData] = await Promise.all([
      this.killDataRepository.getKillDataForCharacters(config.characterIds, config.startDate, config.endDate),
      this.lossDataRepository.getLossDataForCharacters(config.characterIds, config.startDate, config.endDate),
    ]);

    return this.chartDataProcessor.processEfficiencyData(config, killData, lossData);
  }

  private generateCorrelationId(): string {
    return `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
