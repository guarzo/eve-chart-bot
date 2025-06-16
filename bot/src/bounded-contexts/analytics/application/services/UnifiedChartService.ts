/**
 * Unified Chart Service Implementation
 * Orchestrates all chart generation operations in a single, cohesive service
 */

import { IChartService, IChartRenderer } from './IChartService';
import { ChartConfiguration } from '../../domain/value-objects/ChartConfiguration';
import { ChartData } from '../../domain/value-objects/ChartData';
import { OperationResult, ChartType } from '../../../../shared/types/common';
import { KillsDataProcessor, KillDataPoint } from '../../domain/services/processors/KillsDataProcessor';
import { LossDataProcessor, LossDataPoint } from '../../domain/services/processors/LossDataProcessor';
import { EfficiencyDataProcessor } from '../../domain/services/processors/EfficiencyDataProcessor';
import { ChartCacheRepository } from '../use-cases/GenerateChartUseCase';
import { logger } from '../../../../lib/logger';

// Repository interfaces for data access
interface DataRepository {
  getKillData(characterIds: bigint[], startDate: Date, endDate: Date): Promise<KillDataPoint[]>;
  getLossData(characterIds: bigint[], startDate: Date, endDate: Date): Promise<LossDataPoint[]>;
  getGroupLabels(characterIds: bigint[]): Promise<Map<bigint, string>>;
}

export class UnifiedChartService implements IChartService {
  private readonly killsProcessor: KillsDataProcessor;
  private readonly lossProcessor: LossDataProcessor;
  private readonly efficiencyProcessor: EfficiencyDataProcessor;

  constructor(
    private readonly dataRepository: DataRepository,
    private readonly cacheRepository: ChartCacheRepository,
    private readonly chartRenderer: IChartRenderer
  ) {
    // Initialize domain processors
    this.killsProcessor = new KillsDataProcessor();
    this.lossProcessor = new LossDataProcessor();
    this.efficiencyProcessor = new EfficiencyDataProcessor();
  }

  /**
   * Generate a chart image buffer based on configuration
   */
  async generateChart(config: ChartConfiguration): Promise<OperationResult<Buffer>> {
    const correlationId = this.generateCorrelationId();
    const startTime = Date.now();

    try {
      logger.info('Generating chart', {
        type: config.type,
        characterCount: config.characterIds.length,
        correlationId
      });

      // 1. Check cache for rendered chart
      const cacheKey = config.getCacheKey();
      const cachedChart = await this.getCachedChart(cacheKey);
      
      if (cachedChart) {
        logger.info('Chart cache hit', { correlationId, cacheKey });
        return {
          success: true,
          data: cachedChart,
          correlationId
        };
      }

      // 2. Generate chart data
      const dataResult = await this.generateChartData(config);
      
      if (!dataResult.success || !dataResult.data) {
        return {
          success: false,
          error: dataResult.error || 'Failed to generate chart data',
          correlationId
        };
      }

      // 3. Render the chart
      const renderedChart = await this.chartRenderer.render(dataResult.data, config);

      // 4. Cache the rendered chart
      await this.cacheRepository.set(
        cacheKey,
        dataResult.data,
        this.getCacheTTL(config.type)
      );

      const processingTime = Date.now() - startTime;
      logger.info('Chart generated successfully', {
        type: config.type,
        processingTimeMs: processingTime,
        correlationId
      });

      return {
        success: true,
        data: renderedChart,
        correlationId
      };

    } catch (error) {
      logger.error('Chart generation failed', {
        error,
        type: config.type,
        correlationId
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        correlationId
      };
    }
  }

  /**
   * Generate chart data without rendering
   */
  async generateChartData(config: ChartConfiguration): Promise<OperationResult<ChartData>> {
    const correlationId = this.generateCorrelationId();

    try {
      // Validate configuration
      if (!await this.validateConfiguration(config)) {
        return {
          success: false,
          error: 'Invalid chart configuration',
          correlationId
        };
      }

      // Get group labels for the characters
      const groupLabels = await this.getGroupLabels(config.characterIds);

      // Generate data based on chart type
      let chartData: ChartData;

      switch (config.type) {
        case ChartType.KILLS:
          chartData = await this.generateKillChartData(config, groupLabels);
          break;

        case ChartType.LOSSES:
          chartData = await this.generateLossChartData(config, groupLabels);
          break;

        case ChartType.EFFICIENCY:
          chartData = await this.generateEfficiencyChartData(config, groupLabels);
          break;

        default:
          return {
            success: false,
            error: `Unsupported chart type: ${config.type}`,
            correlationId
          };
      }

      return {
        success: true,
        data: chartData,
        correlationId
      };

    } catch (error) {
      logger.error('Chart data generation failed', {
        error,
        type: config.type,
        correlationId
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        correlationId
      };
    }
  }

  /**
   * Get a cached chart if available
   */
  async getCachedChart(key: string): Promise<Buffer | null> {
    try {
      const cachedData = await this.cacheRepository.get(key);
      if (!cachedData) return null;

      // If we have cached ChartData, we need to re-render it
      // In a production system, we might cache the rendered buffer separately
      return null; // For now, always regenerate
    } catch (error) {
      logger.warn('Cache retrieval failed', { error, key });
      return null;
    }
  }

  /**
   * Invalidate cache for specific patterns
   */
  async invalidateCache(pattern: string): Promise<void> {
    try {
      await this.cacheRepository.invalidate(pattern);
      logger.info('Cache invalidated', { pattern });
    } catch (error) {
      logger.error('Cache invalidation failed', { error, pattern });
    }
  }

  /**
   * Get supported chart types
   */
  getSupportedChartTypes(): string[] {
    return Object.values(ChartType);
  }

  /**
   * Validate chart configuration
   */
  async validateConfiguration(_config: ChartConfiguration): Promise<boolean> {
    try {
      // Configuration validates itself in constructor
      // Additional async validation could go here
      return true;
    } catch {
      return false;
    }
  }

  // Private helper methods

  private async generateKillChartData(
    config: ChartConfiguration,
    groupLabels: string[]
  ): Promise<ChartData> {
    const killData = await this.dataRepository.getKillData(
      config.characterIds,
      config.startDate,
      config.endDate
    );

    return this.killsProcessor.processKillData(config, killData, groupLabels);
  }

  private async generateLossChartData(
    config: ChartConfiguration,
    groupLabels: string[]
  ): Promise<ChartData> {
    const lossData = await this.dataRepository.getLossData(
      config.characterIds,
      config.startDate,
      config.endDate
    );

    return this.lossProcessor.processLossData(config, lossData, groupLabels);
  }

  private async generateEfficiencyChartData(
    config: ChartConfiguration,
    groupLabels: string[]
  ): Promise<ChartData> {
    const [killData, lossData] = await Promise.all([
      this.dataRepository.getKillData(
        config.characterIds,
        config.startDate,
        config.endDate
      ),
      this.dataRepository.getLossData(
        config.characterIds,
        config.startDate,
        config.endDate
      )
    ]);

    return this.efficiencyProcessor.processEfficiencyData(
      config,
      killData,
      lossData,
      groupLabels
    );
  }

  private async getGroupLabels(characterIds: bigint[]): Promise<string[]> {
    const labelMap = await this.dataRepository.getGroupLabels(characterIds);
    
    // Convert map to array of labels
    return characterIds.map(id => labelMap.get(id) || 'Unknown');
  }

  private getCacheTTL(chartType: ChartType): number {
    // Different TTLs for different chart types
    switch (chartType) {
      case ChartType.KILLS:
      case ChartType.LOSSES:
        return 300; // 5 minutes
      case ChartType.EFFICIENCY:
        return 600; // 10 minutes
      default:
        return 300;
    }
  }

  private generateCorrelationId(): string {
    return `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}