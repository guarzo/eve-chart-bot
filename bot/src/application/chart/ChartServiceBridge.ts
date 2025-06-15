import { ChartData, ChartOptions, ChartService } from './ChartService';
import { SimplifiedChartService } from './SimplifiedChartService';
import { ChartPipelineFactory } from './factories/ChartPipelineFactory';
import { flags } from '../../shared/utilities/feature-flags';
import { logger } from '../../lib/logger';

/**
 * Bridge service that maintains backward compatibility while using the new simplified pipeline
 * This allows gradual migration from the old feature-flag-based service to the clean pipeline
 */
export class ChartServiceBridge {
  private readonly simplifiedService: SimplifiedChartService;
  private readonly legacyService: ChartService;
  private readonly useNewPipeline: boolean;

  constructor() {
    // Create simplified service with feature flag migration
    this.simplifiedService = new SimplifiedChartService(
      ChartPipelineFactory.createWithFeatureFlags(
        flags.newChartRendering,
        flags.newChartRendering // Use same flag for both rendering and data
      )
    );

    // Keep legacy service for comparison/fallback
    this.legacyService = new ChartService();

    // Determine which pipeline to use
    this.useNewPipeline = process.env.USE_SIMPLIFIED_CHART_SERVICE === 'true';

    logger.info('ChartServiceBridge: Initialized', {
      useNewPipeline: this.useNewPipeline,
      newChartRendering: flags.newChartRendering,
    });
  }

  /**
   * Generate ship usage chart (backward compatible interface)
   */
  async generateShipUsageChart(
    characterId?: string,
    groupId?: string,
    days: number = 30
  ): Promise<ChartData | null> {
    if (this.useNewPipeline) {
      logger.debug('ChartServiceBridge: Using simplified service for ship usage chart');
      return await this.simplifiedService.generateShipUsageData(characterId, groupId, days);
    } else {
      logger.debug('ChartServiceBridge: Using legacy service for ship usage chart');
      return await this.legacyService.generateShipUsageChart(characterId, groupId, days);
    }
  }

  /**
   * Render chart (backward compatible interface)
   */
  async renderChart(chartData: ChartData, options: Partial<ChartOptions> = {}): Promise<Buffer | null> {
    if (this.useNewPipeline) {
      logger.debug('ChartServiceBridge: Using simplified service for chart rendering');
      return await this.simplifiedService.renderChartAsPNG(chartData, options);
    } else {
      logger.debug('ChartServiceBridge: Using legacy service for chart rendering');
      return await this.legacyService.renderChart(chartData, options);
    }
  }

  /**
   * Generate complete ship usage chart as PNG
   */
  async generateShipUsageChartPNG(
    characterId?: string,
    groupId?: string,
    days: number = 30,
    options?: Partial<ChartOptions>
  ): Promise<Buffer | null> {
    if (this.useNewPipeline) {
      logger.debug('ChartServiceBridge: Using simplified service for complete ship usage chart');
      return await this.simplifiedService.generateShipUsageChart(characterId, groupId, days, options);
    } else {
      logger.debug('ChartServiceBridge: Using legacy service for complete ship usage chart');
      const chartData = await this.legacyService.generateShipUsageChart(characterId, groupId, days);
      if (!chartData) return null;
      return await this.legacyService.renderChart(chartData, options);
    }
  }

  /**
   * Generate ship usage chart as HTML (new feature)
   */
  async generateShipUsageChartHTML(
    characterId?: string,
    groupId?: string,
    days: number = 30,
    options?: Partial<ChartOptions>
  ): Promise<string | null> {
    if (this.useNewPipeline) {
      logger.debug('ChartServiceBridge: Using simplified service for HTML chart');
      return await this.simplifiedService.generateShipUsageHTML(characterId, groupId, days, options);
    } else {
      logger.warn('ChartServiceBridge: HTML generation not supported in legacy service');
      return null;
    }
  }

  /**
   * Get service info for debugging
   */
  getServiceInfo(): {
    useNewPipeline: boolean;
    newChartRendering: boolean;
    simplifiedServiceAvailable: boolean;
    legacyServiceAvailable: boolean;
  } {
    return {
      useNewPipeline: this.useNewPipeline,
      newChartRendering: flags.newChartRendering,
      simplifiedServiceAvailable: !!this.simplifiedService,
      legacyServiceAvailable: !!this.legacyService,
    };
  }
}