/**
 * Redis implementation of ChartCacheRepository
 * Infrastructure layer - handles chart data caching using Redis
 */

import { ChartCacheRepository } from '../../application/use-cases/GenerateChartUseCase';
import { ChartData, ChartDataset, ChartMetadata } from '../../domain/value-objects/ChartData';
import { ChartType } from '../../../../shared/types/common';
import Redis from 'ioredis';

export class RedisChartCacheRepository implements ChartCacheRepository {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<ChartData | null> {
    try {
      const cachedData = await this.redis.get(key);
      if (!cachedData) {
        return null;
      }

      const parsed = JSON.parse(cachedData);
      return this.deserializeChartData(parsed);
    } catch (error) {
      console.warn('Failed to retrieve chart data from cache:', error);
      return null;
    }
  }

  async set(key: string, data: ChartData, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(this.serializeChartData(data));
      await this.redis.setex(key, ttlSeconds, serialized);
    } catch (error) {
      console.warn('Failed to cache chart data:', error);
      // Don't throw - caching failures shouldn't break chart generation
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.warn('Failed to invalidate cache pattern:', pattern, error);
    }
  }

  private serializeChartData(data: ChartData): any {
    return {
      type: data.type,
      labels: data.labels,
      datasets: data.datasets.map(dataset => ({
        label: dataset.label,
        data: dataset.data,
        backgroundColor: dataset.backgroundColor,
        borderColor: dataset.borderColor,
        borderWidth: dataset.borderWidth,
        fill: dataset.fill,
      })),
      metadata: {
        generatedAt: data.metadata.generatedAt.toISOString(),
        dataPointCount: data.metadata.dataPointCount,
        processingTimeMs: data.metadata.processingTimeMs,
        cacheHit: data.metadata.cacheHit,
        correlationId: data.metadata.correlationId,
      },
    };
  }

  private deserializeChartData(data: any): ChartData {
    const datasets = data.datasets.map(
      (ds: any) => new ChartDataset(ds.label, ds.data, ds.backgroundColor, ds.borderColor, ds.borderWidth, ds.fill)
    );

    const metadata = new ChartMetadata(
      new Date(data.metadata.generatedAt),
      data.metadata.dataPointCount,
      data.metadata.processingTimeMs,
      true, // Mark as cache hit
      data.metadata.correlationId
    );

    return new ChartData(data.type as ChartType, data.labels, datasets, metadata);
  }
}
