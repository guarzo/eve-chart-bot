import { BaseChartService } from '../BaseChartService';
import { IChartService } from '../interfaces/IChartService';
import { KillsChartService } from './KillsChartService';
import { MapActivityChartService } from './MapActivityChartService';
import { ChartConfigInput, ChartData } from '../../../types/chart';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../lib/logger';

export class MainChartService extends BaseChartService implements IChartService {
  private readonly killsChartService: KillsChartService;
  private readonly mapActivityChartService: MapActivityChartService;

  constructor(prisma: PrismaClient) {
    super(prisma);
    this.killsChartService = new KillsChartService(prisma);
    this.mapActivityChartService = new MapActivityChartService(prisma);
  }

  async generateChart(config: ChartConfigInput): Promise<ChartData> {
    const {
      type,
      characterIds,
      period,
      groupBy = 'hour',
      displayType = 'line',
      displayMetric = 'value',
      limit = 10,
    } = config;

    logger.info(`Generating ${type} chart with config:`, {
      type,
      characterIds: characterIds.length,
      period,
      groupBy,
      displayType,
      displayMetric,
      limit,
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
        throw new Error(`Unsupported chart type: ${type}`);
    }
  }
}
