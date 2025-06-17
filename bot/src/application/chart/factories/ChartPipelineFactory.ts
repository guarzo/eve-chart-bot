import { ChartPipeline, IChartDataProvider, IChartRenderer } from '../pipeline/ChartPipeline';
import { ShipUsageDataProvider } from '../providers/ShipUsageDataProvider';
import { StrategyChartRenderer } from '../renderers/StrategyChartRenderer';
import { BasicChartRenderStrategy } from '../strategies/BasicChartRenderStrategy';
import { AdvancedChartRenderStrategy } from '../strategies/AdvancedChartRenderStrategy';
import { RepositoryManager } from '../../../infrastructure/repositories/RepositoryManager';
import { CacheAdapter } from '../../../cache/CacheAdapter';
import { CacheRedisAdapter } from '../../../cache/CacheRedisAdapter';
import { ValidatedConfiguration as Configuration } from '../../../config/validated';
import { logger } from '../../../lib/logger';

/**
 * Chart rendering mode
 */
export type ChartRenderingMode = 'basic' | 'advanced';

/**
 * Chart data mode
 */
export type ChartDataMode = 'real' | 'mock';

/**
 * Factory configuration
 */
export interface ChartPipelineConfig {
  renderingMode?: ChartRenderingMode;
  dataMode?: ChartDataMode;
  cacheAdapter?: CacheAdapter;
  repositoryManager?: RepositoryManager;
}

/**
 * Factory for creating clean chart pipelines
 * Removes feature flag complexity by using explicit configuration
 */
export class ChartPipelineFactory {
  /**
   * Create a complete chart pipeline for ship usage charts
   */
  static createShipUsagePipeline(config: ChartPipelineConfig = {}): ChartPipeline {
    logger.info('ChartPipelineFactory: Creating ship usage pipeline', {
      renderingMode: config.renderingMode ?? 'basic',
      dataMode: config.dataMode ?? 'real',
    });

    // Create data provider
    const dataProvider = this.createShipUsageDataProvider(config);

    // Create renderer
    const renderer = this.createRenderer(config.renderingMode ?? 'basic');

    return new ChartPipeline(dataProvider, renderer);
  }

  /**
   * Create ship usage data provider
   */
  private static createShipUsageDataProvider(config: ChartPipelineConfig): IChartDataProvider {
    const repositoryManager = config.repositoryManager ?? RepositoryManager.getInstance();
    const cacheAdapter = config.cacheAdapter ?? this.createDefaultCache();
    const useRealData = config.dataMode !== 'mock';

    logger.info('ChartPipelineFactory: Creating ship usage data provider', {
      useRealData,
      cacheEnabled: !!cacheAdapter,
    });

    return new ShipUsageDataProvider(repositoryManager, cacheAdapter, useRealData);
  }

  /**
   * Create chart renderer based on mode
   */
  private static createRenderer(mode: ChartRenderingMode): IChartRenderer {
    logger.info('ChartPipelineFactory: Creating chart renderer', { mode });

    const strategy = mode === 'advanced' ? new AdvancedChartRenderStrategy() : new BasicChartRenderStrategy();

    return new StrategyChartRenderer(strategy);
  }

  /**
   * Create default cache adapter
   */
  private static createDefaultCache(): CacheAdapter {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const ttl = Configuration.charts.defaultCacheTTLSeconds;

    logger.info('ChartPipelineFactory: Creating default Redis cache', {
      redisUrl: redisUrl.replace(/\/\/[^@]*@/, '//***@'), // Hide credentials in logs
      ttl,
    });

    return new CacheRedisAdapter(redisUrl, ttl);
  }

  /**
   * Create pipeline from environment variables (clean feature flag replacement)
   */
  static createFromEnvironment(): ChartPipeline {
    const renderingMode: ChartRenderingMode = process.env.CHART_RENDERING_MODE === 'advanced' ? 'advanced' : 'basic';

    const dataMode: ChartDataMode = process.env.CHART_DATA_MODE === 'mock' ? 'mock' : 'real';

    logger.info('ChartPipelineFactory: Creating pipeline from environment', {
      renderingMode,
      dataMode,
    });

    return this.createShipUsagePipeline({
      renderingMode,
      dataMode,
    });
  }

  /**
   * Create pipeline with explicit feature toggles (migration helper)
   */
  static createWithFeatureFlags(useAdvancedRendering: boolean, useRealData: boolean): ChartPipeline {
    logger.info('ChartPipelineFactory: Creating pipeline with feature flags', {
      useAdvancedRendering,
      useRealData,
    });

    return this.createShipUsagePipeline({
      renderingMode: useAdvancedRendering ? 'advanced' : 'basic',
      dataMode: useRealData ? 'real' : 'mock',
    });
  }
}
