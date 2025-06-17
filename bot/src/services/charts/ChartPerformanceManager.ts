import { destroyChartWorkerManager } from './workers/ChartWorker';
import { chartCacheService } from './cache/ChartCacheService';
import { logger } from '../../lib/logger';

export class ChartPerformanceManager {
  private static instance: ChartPerformanceManager;
  private isInitialized = false;
  private shutdownHandlers: Array<() => Promise<void>> = [];

  private constructor() {}

  static getInstance(): ChartPerformanceManager {
    if (!ChartPerformanceManager.instance) {
      ChartPerformanceManager.instance = new ChartPerformanceManager();
    }
    return ChartPerformanceManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing chart performance manager...');

      // Set up graceful shutdown handlers
      this.setupShutdownHandlers();

      // Log cache stats on startup
      const cacheStats = await chartCacheService.getCacheStats();
      logger.info('Chart cache initialization:', cacheStats);

      this.isInitialized = true;
      logger.info('Chart performance manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize chart performance manager:', error);
      throw error;
    }
  }

  private setupShutdownHandlers(): void {
    const shutdownHandler = async (signal: string) => {
      logger.info(`Received ${signal}, cleaning up chart performance resources...`);
      await this.cleanup();
      process.exit(0);
    };

    // Handle various termination signals
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGQUIT', () => shutdownHandler('SIGQUIT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', async error => {
      logger.error('Uncaught exception in chart performance manager:', error);
      await this.cleanup();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, _promise) => {
      logger.error('Unhandled rejection in chart performance manager:', reason);
      await this.cleanup();
      process.exit(1);
    });
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up chart performance resources...');

    try {
      // Cleanup worker threads
      await destroyChartWorkerManager();
      logger.info('Chart worker threads cleaned up');

      // Execute any additional shutdown handlers
      await Promise.all(this.shutdownHandlers.map(handler => handler()));

      logger.info('Chart performance manager cleanup completed');
    } catch (error) {
      logger.error('Error during chart performance cleanup:', error);
    }
  }

  addShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  async getPerformanceMetrics(): Promise<{
    cacheStats: any;
    workerStats: any;
    memoryUsage: NodeJS.MemoryUsage;
  }> {
    const [cacheStats, memoryUsage] = await Promise.all([
      chartCacheService.getCacheStats(),
      Promise.resolve(process.memoryUsage()),
    ]);

    return {
      cacheStats,
      workerStats: {
        // Add worker thread metrics if needed
        nodeEnv: process.env.NODE_ENV,
        useOptimizedCharts: process.env.USE_OPTIMIZED_CHARTS !== 'false',
        chartWorkerCount: process.env.CHART_WORKER_COUNT || '2',
        chartBatchSize: process.env.CHART_BATCH_SIZE || '100',
      },
      memoryUsage,
    };
  }

  async invalidateCache(type: 'character' | 'timeRange', params: any): Promise<void> {
    switch (type) {
      case 'character':
        await chartCacheService.invalidateCharacterCache(params.characterIds);
        break;
      case 'timeRange':
        await chartCacheService.invalidateTimeRangeCache(params.startDate, params.endDate);
        break;
      default:
        logger.warn(`Unknown cache invalidation type: ${type}`);
    }
  }
}

export const chartPerformanceManager = ChartPerformanceManager.getInstance();
