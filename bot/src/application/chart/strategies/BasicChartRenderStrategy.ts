import { BaseChartRenderStrategy } from './BaseChartRenderStrategy';
import { ChartData, ChartOptions } from '../ChartService';
import { logger } from '../../../lib/logger';

/**
 * Basic chart rendering strategy that provides simple mock implementations
 */
export class BasicChartRenderStrategy extends BaseChartRenderStrategy {
  async renderPNG(_chartData: ChartData, options?: Partial<ChartOptions>): Promise<Buffer | null> {
    try {
      logger.info(`Rendering basic PNG chart: ${options?.title ?? 'Untitled'}`);

      // Basic mock implementation
      const mockChartBuffer = Buffer.from('Basic chart rendering output');
      return mockChartBuffer;
    } catch (error) {
      this.logError(error, 'Failed to render basic chart as PNG');
      return null;
    }
  }

  // The renderHTML method is inherited from BaseChartRenderStrategy
  // No need to override it since the basic implementation uses the default behavior
}
