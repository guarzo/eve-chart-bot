import { BaseChartService } from '../BaseChartService';
import { IChartService } from '../interfaces/IChartService';
import { KillsChartService } from './KillsChartService';
import { MapActivityChartService } from './MapActivityChartService';
import { OptimizedChartService } from '../OptimizedChartService';
import { ChartConfigInput, ChartData, ChartOptions } from '../../../types/chart';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../lib/logger';
import { errorHandler, ValidationError, ChartError } from '../../../shared/errors';

export class MainChartService extends BaseChartService implements IChartService {
  private readonly killsChartService: KillsChartService;
  private readonly mapActivityChartService: MapActivityChartService;
  private readonly optimizedChartService: OptimizedChartService;
  private readonly useOptimizedCharts: boolean;

  constructor(prisma: PrismaClient) {
    super(prisma);
    this.killsChartService = new KillsChartService(prisma);
    this.mapActivityChartService = new MapActivityChartService(prisma);
    this.optimizedChartService = new OptimizedChartService(prisma);
    this.useOptimizedCharts = process.env.USE_OPTIMIZED_CHARTS !== 'false';
  }

  async generateChart(config: ChartConfigInput): Promise<ChartData> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      const {
        type,
        characterIds,
        period,
        groupBy = 'hour',
        displayType = 'line',
        displayMetric = 'value',
        limit = 10,
      } = config;

      // Input validation
      this.validateChartConfig(config, correlationId);

      logger.info(`Generating ${type} chart with config:`, {
        type,
        characterIds: characterIds.length,
        period,
        groupBy,
        displayType,
        displayMetric,
        limit,
        optimized: this.useOptimizedCharts,
        correlationId,
      });

      // Calculate start date based on period
      const startDate = this.calculateStartDate(period);

      // Generate chart based on type
      switch (type) {
        case 'kills':
          return this.killsChartService.generateKillsChart(
            characterIds.map(id => id.toString()),
            startDate,
            groupBy,
            displayMetric,
            limit
          );

        case 'map_activity':
          return this.mapActivityChartService.generateMapActivityChart(
            characterIds.map(id => id.toString()),
            startDate,
            groupBy,
            displayMetric,
            limit
          );

        default:
          throw ChartError.configError(type, `Unsupported chart type '${type}'. Supported types: kills, map_activity`, {
            correlationId,
            operation: 'generateChart',
            metadata: { supportedTypes: ['kills', 'map_activity'] },
          });
      }
    } catch (error) {
      throw errorHandler.handleChartError(
        error,
        config.type || 'unknown',
        config.characterIds?.map(id => id.toString())
      );
    }
  }

  async generateOptimizedChart(config: ChartConfigInput, options: ChartOptions = {}): Promise<Buffer> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      const { type, characterIds, period, groupBy = 'hour', displayMetric = 'value', limit = 10 } = config;

      logger.info('Generating optimized chart', {
        correlationId,
        type,
        characterCount: characterIds.length,
        period,
        groupBy,
        displayMetric,
        limit,
      });

      const startDate = this.calculateStartDate(period);

      switch (type) {
        case 'kills':
          return await this.optimizedChartService.generateOptimizedKillsChart(
            characterIds.map(id => id.toString()),
            startDate,
            groupBy,
            displayMetric,
            limit,
            options
          );

        default:
          throw ChartError.configError(
            type,
            `Unsupported chart type '${type}' for optimized charts. Supported types: kills`,
            {
              correlationId,
              operation: 'generateOptimizedChart',
              metadata: { supportedTypes: ['kills'] },
            }
          );
      }
    } catch (error) {
      throw errorHandler.handleChartError(
        error,
        config.type || 'unknown',
        config.characterIds?.map(id => id.toString())
      );
    }
  }

  /**
   * Validate chart configuration
   */
  private validateChartConfig(config: ChartConfigInput, correlationId: string): void {
    if (!config.type) {
      throw ValidationError.fieldRequired('type', {
        correlationId,
        operation: 'validateChartConfig',
      });
    }

    if (!config.characterIds || config.characterIds.length === 0) {
      throw ValidationError.fieldRequired('characterIds', {
        correlationId,
        operation: 'validateChartConfig',
      });
    }

    if (!config.period) {
      throw ValidationError.fieldRequired('period', {
        correlationId,
        operation: 'validateChartConfig',
      });
    }
  }
}
