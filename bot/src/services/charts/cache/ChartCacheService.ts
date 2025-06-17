import { createHash } from 'crypto';
import { redis } from '../../../infrastructure/cache/redis-client';
import { logger } from '../../../lib/logger';
import { ChartData, ChartOptions } from '../../../types/chart';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  prefix: string;
  compression?: boolean;
}

export interface ChartCacheKey {
  type: 'data' | 'result';
  characterIds: string[];
  startDate: string;
  endDate?: string;
  groupBy?: string;
  displayMetric?: string;
  options?: string; // Serialized options hash
}

export class ChartCacheService {
  private readonly configs: Map<string, CacheConfig> = new Map([
    ['chart_data', { ttl: 300, prefix: 'chart_data:' }], // 5 minutes for processed data
    ['chart_result', { ttl: 1800, prefix: 'chart_result:' }], // 30 minutes for rendered charts
    ['db_query', { ttl: 120, prefix: 'db_query:' }], // 2 minutes for DB query results
    ['aggregated_data', { ttl: 600, prefix: 'agg_data:' }], // 10 minutes for aggregated data
  ]);

  private generateCacheKey(keyData: ChartCacheKey): string {
    const keyString = JSON.stringify({
      ...keyData,
      characterIds: keyData.characterIds.sort(), // Ensure consistent ordering
    });

    const hash = createHash('sha256').update(keyString).digest('hex').substring(0, 16);
    const config = this.configs.get(keyData.type === 'data' ? 'chart_data' : 'chart_result');
    return `${config?.prefix || 'chart:'}${hash}`;
  }

  async getCachedChartData(keyData: Omit<ChartCacheKey, 'type'>): Promise<ChartData | null> {
    try {
      const key = this.generateCacheKey({ ...keyData, type: 'data' });
      const cached = await redis.get(key);

      if (cached) {
        logger.debug(`Chart data cache hit for key: ${key}`);
        return JSON.parse(cached);
      }

      logger.debug(`Chart data cache miss for key: ${key}`);
      return null;
    } catch (error) {
      logger.error('Error getting cached chart data:', error);
      return null;
    }
  }

  async setCachedChartData(keyData: Omit<ChartCacheKey, 'type'>, data: ChartData): Promise<void> {
    try {
      const key = this.generateCacheKey({ ...keyData, type: 'data' });
      const config = this.configs.get('chart_data')!;

      await redis.setex(key, config.ttl, JSON.stringify(data));
      logger.debug(`Cached chart data with key: ${key}, TTL: ${config.ttl}s`);
    } catch (error) {
      logger.error('Error caching chart data:', error);
    }
  }

  async getCachedChartResult(keyData: Omit<ChartCacheKey, 'type'>): Promise<Buffer | null> {
    try {
      const key = this.generateCacheKey({ ...keyData, type: 'result' });
      const cached = await redis.getBuffer(key);

      if (cached) {
        logger.debug(`Chart result cache hit for key: ${key}`);
        return cached;
      }

      logger.debug(`Chart result cache miss for key: ${key}`);
      return null;
    } catch (error) {
      logger.error('Error getting cached chart result:', error);
      return null;
    }
  }

  async setCachedChartResult(keyData: Omit<ChartCacheKey, 'type'>, buffer: Buffer): Promise<void> {
    try {
      const key = this.generateCacheKey({ ...keyData, type: 'result' });
      const config = this.configs.get('chart_result')!;

      await redis.setex(key, config.ttl, buffer);
      logger.debug(`Cached chart result with key: ${key}, TTL: ${config.ttl}s, size: ${buffer.length} bytes`);
    } catch (error) {
      logger.error('Error caching chart result:', error);
    }
  }

  async getCachedDbQuery<T>(queryKey: string): Promise<T | null> {
    try {
      const key = `${this.configs.get('db_query')?.prefix}${queryKey}`;
      const cached = await redis.get(key);

      if (cached) {
        logger.debug(`DB query cache hit for key: ${key}`);
        return JSON.parse(cached);
      }

      logger.debug(`DB query cache miss for key: ${key}`);
      return null;
    } catch (error) {
      logger.error('Error getting cached DB query:', error);
      return null;
    }
  }

  async setCachedDbQuery<T>(queryKey: string, data: T): Promise<void> {
    try {
      const key = `${this.configs.get('db_query')?.prefix}${queryKey}`;
      const config = this.configs.get('db_query')!;

      await redis.setex(key, config.ttl, JSON.stringify(data));
      logger.debug(`Cached DB query with key: ${key}, TTL: ${config.ttl}s`);
    } catch (error) {
      logger.error('Error caching DB query:', error);
    }
  }

  async getCachedAggregatedData<T>(aggregationKey: string): Promise<T | null> {
    try {
      const key = `${this.configs.get('aggregated_data')?.prefix}${aggregationKey}`;
      const cached = await redis.get(key);

      if (cached) {
        logger.debug(`Aggregated data cache hit for key: ${key}`);
        return JSON.parse(cached);
      }

      logger.debug(`Aggregated data cache miss for key: ${key}`);
      return null;
    } catch (error) {
      logger.error('Error getting cached aggregated data:', error);
      return null;
    }
  }

  async setCachedAggregatedData<T>(aggregationKey: string, data: T): Promise<void> {
    try {
      const key = `${this.configs.get('aggregated_data')?.prefix}${aggregationKey}`;
      const config = this.configs.get('aggregated_data')!;

      await redis.setex(key, config.ttl, JSON.stringify(data));
      logger.debug(`Cached aggregated data with key: ${key}, TTL: ${config.ttl}s`);
    } catch (error) {
      logger.error('Error caching aggregated data:', error);
    }
  }

  generateDbQueryKey(params: {
    operation: string;
    characterIds?: bigint[];
    startDate?: Date;
    endDate?: Date;
    additionalParams?: Record<string, any>;
  }): string {
    const keyData = {
      operation: params.operation,
      characterIds: params.characterIds?.map(id => id.toString()).sort(),
      startDate: params.startDate?.toISOString(),
      endDate: params.endDate?.toISOString(),
      ...params.additionalParams,
    };

    return createHash('sha256').update(JSON.stringify(keyData)).digest('hex').substring(0, 16);
  }

  generateAggregationKey(params: {
    type: string;
    characterIds?: string[];
    timeRange?: string;
    groupBy?: string;
    additionalParams?: Record<string, any>;
  }): string {
    const keyData = {
      type: params.type,
      characterIds: params.characterIds?.sort(),
      timeRange: params.timeRange,
      groupBy: params.groupBy,
      ...params.additionalParams,
    };

    return createHash('sha256').update(JSON.stringify(keyData)).digest('hex').substring(0, 16);
  }

  async invalidateCharacterCache(characterIds: string[]): Promise<void> {
    try {
      const patterns = [
        `chart_data:*${characterIds.join('*')}*`,
        `chart_result:*${characterIds.join('*')}*`,
        `db_query:*${characterIds.join('*')}*`,
        `agg_data:*${characterIds.join('*')}*`,
      ];

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          logger.debug(`Invalidated ${keys.length} cache entries for pattern: ${pattern}`);
        }
      }
    } catch (error) {
      logger.error('Error invalidating character cache:', error);
    }
  }

  async invalidateTimeRangeCache(startDate: Date, endDate?: Date): Promise<void> {
    try {
      const endDateStr = endDate?.toISOString() || new Date().toISOString();
      const patterns = [
        `chart_data:*${startDate.toISOString()}*`,
        `chart_result:*${startDate.toISOString()}*`,
        `db_query:*${startDate.toISOString()}*`,
      ];

      if (endDate) {
        patterns.push(`chart_data:*${endDateStr}*`, `chart_result:*${endDateStr}*`, `db_query:*${endDateStr}*`);
      }

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          logger.debug(`Invalidated ${keys.length} cache entries for pattern: ${pattern}`);
        }
      }
    } catch (error) {
      logger.error('Error invalidating time range cache:', error);
    }
  }

  async getCacheStats(): Promise<{
    totalKeys: number;
    chartDataKeys: number;
    chartResultKeys: number;
    dbQueryKeys: number;
    aggregatedDataKeys: number;
  }> {
    try {
      const [chartDataKeys, chartResultKeys, dbQueryKeys, aggregatedDataKeys] = await Promise.all([
        redis.keys('chart_data:*'),
        redis.keys('chart_result:*'),
        redis.keys('db_query:*'),
        redis.keys('agg_data:*'),
      ]);

      return {
        totalKeys: chartDataKeys.length + chartResultKeys.length + dbQueryKeys.length + aggregatedDataKeys.length,
        chartDataKeys: chartDataKeys.length,
        chartResultKeys: chartResultKeys.length,
        dbQueryKeys: dbQueryKeys.length,
        aggregatedDataKeys: aggregatedDataKeys.length,
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return {
        totalKeys: 0,
        chartDataKeys: 0,
        chartResultKeys: 0,
        dbQueryKeys: 0,
        aggregatedDataKeys: 0,
      };
    }
  }

  generateOptionsHash(options: ChartOptions): string {
    const sanitizedOptions = {
      width: options.width,
      height: options.height,
      responsive: options.responsive,
      maintainAspectRatio: options.maintainAspectRatio,
    };

    return createHash('sha256').update(JSON.stringify(sanitizedOptions)).digest('hex').substring(0, 8);
  }
}

export const chartCacheService = new ChartCacheService();
