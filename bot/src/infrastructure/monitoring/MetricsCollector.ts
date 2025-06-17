import { logger } from '../../lib/logger';
import { EventEmitter } from 'events';

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timing';
}

export interface MetricSnapshot {
  timestamp: number;
  metrics: {
    discord: {
      commandsProcessed: number;
      commandErrors: number;
      averageResponseTime: number;
      activeCommands: number;
    };
    database: {
      queryCount: number;
      queryErrors: number;
      averageQueryTime: number;
      connectionPoolSize: number;
    };
    charts: {
      generationCount: number;
      cacheHits: number;
      cacheMisses: number;
      averageGenerationTime: number;
      workerThreadsActive: number;
    };
    websocket: {
      messagesReceived: number;
      connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
      reconnectAttempts: number;
    };
    system: {
      memoryUsage: NodeJS.MemoryUsage;
      cpuUsage: NodeJS.CpuUsage;
      eventLoopDelay: number;
      gcStats?: any;
    };
  };
}

export class MetricsCollector extends EventEmitter {
  private metrics = new Map<string, Metric[]>();
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private timings = new Map<string, number[]>();
  
  private readonly maxMetricsHistory = 1000;
  private readonly metricsRetentionMs = 3600000; // 1 hour
  
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000); // Clean up every 5 minutes
  }

  // Counter operations
  incrementCounter(name: string, value = 1, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const currentValue = this.counters.get(key) || 0;
    this.counters.set(key, currentValue + value);
    
    this.recordMetric({
      name,
      value: currentValue + value,
      timestamp: Date.now(),
      labels,
      type: 'counter',
    });
  }

  // Gauge operations
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);
    
    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      labels,
      type: 'gauge',
    });
  }

  // Histogram operations
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    
    // Keep only recent values
    if (values.length > 100) {
      values.splice(0, values.length - 100);
    }
    
    this.histograms.set(key, values);
    
    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      labels,
      type: 'histogram',
    });
  }

  // Timing operations
  recordTiming(name: string, duration: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const times = this.timings.get(key) || [];
    times.push(duration);
    
    // Keep only recent times
    if (times.length > 100) {
      times.splice(0, times.length - 100);
    }
    
    this.timings.set(key, times);
    
    this.recordMetric({
      name,
      value: duration,
      timestamp: Date.now(),
      labels,
      type: 'timing',
    });
  }

  // Time a function execution
  async timeFunction<T>(name: string, fn: () => Promise<T>, labels?: Record<string, string>): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      this.recordTiming(name, Date.now() - startTime, labels);
      return result;
    } catch (error) {
      this.recordTiming(name, Date.now() - startTime, { ...labels, error: 'true' });
      throw error;
    }
  }

  // Get current metric values
  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.getMetricKey(name, labels);
    return this.counters.get(key) || 0;
  }

  getGauge(name: string, labels?: Record<string, string>): number {
    const key = this.getMetricKey(name, labels);
    return this.gauges.get(key) || 0;
  }

  getHistogramStats(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    min: number;
    max: number;
    mean: number;
    p95: number;
    p99: number;
  } | null {
    const key = this.getMetricKey(name, labels);
    const values = this.histograms.get(key);
    
    if (!values || values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      sum,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / values.length,
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  getTimingStats(name: string, labels?: Record<string, string>): {
    count: number;
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    p95: number;
    p99: number;
  } | null {
    const key = this.getMetricKey(name, labels);
    const times = this.timings.get(key);
    
    if (!times || times.length === 0) return null;
    
    const sorted = [...times].sort((a, b) => a - b);
    const totalTime = times.reduce((a, b) => a + b, 0);
    
    return {
      count: times.length,
      totalTime,
      averageTime: totalTime / times.length,
      minTime: sorted[0],
      maxTime: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  // Get comprehensive metrics snapshot
  async getMetricsSnapshot(): Promise<MetricSnapshot> {
    const timestamp = Date.now();
    
    // Discord metrics
    const commandsProcessed = this.getCounter('discord_commands_processed');
    const commandErrors = this.getCounter('discord_command_errors');
    const commandTiming = this.getTimingStats('discord_command_duration');
    const activeCommands = this.getGauge('discord_active_commands');

    // Database metrics
    const queryCount = this.getCounter('database_queries');
    const queryErrors = this.getCounter('database_query_errors');
    const queryTiming = this.getTimingStats('database_query_duration');
    const connectionPoolSize = this.getGauge('database_connection_pool_size');

    // Chart metrics
    const generationCount = this.getCounter('chart_generations');
    const cacheHits = this.getCounter('chart_cache_hits');
    const cacheMisses = this.getCounter('chart_cache_misses');
    const chartTiming = this.getTimingStats('chart_generation_duration');
    const workerThreadsActive = this.getGauge('chart_worker_threads_active');

    // WebSocket metrics
    const messagesReceived = this.getCounter('websocket_messages_received');
    const reconnectAttempts = this.getCounter('websocket_reconnect_attempts');
    const connectionStatus = this.getGauge('websocket_connection_status') === 1 ? 'connected' : 'disconnected';

    // System metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const eventLoopDelay = this.getGauge('event_loop_delay');

    return {
      timestamp,
      metrics: {
        discord: {
          commandsProcessed,
          commandErrors,
          averageResponseTime: commandTiming?.averageTime || 0,
          activeCommands,
        },
        database: {
          queryCount,
          queryErrors,
          averageQueryTime: queryTiming?.averageTime || 0,
          connectionPoolSize,
        },
        charts: {
          generationCount,
          cacheHits,
          cacheMisses,
          averageGenerationTime: chartTiming?.averageTime || 0,
          workerThreadsActive,
        },
        websocket: {
          messagesReceived,
          connectionStatus: connectionStatus as any,
          reconnectAttempts,
        },
        system: {
          memoryUsage,
          cpuUsage,
          eventLoopDelay,
        },
      },
    };
  }

  // Get metrics in Prometheus format
  getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // Counters
    for (const [key, value] of this.counters) {
      const { name, labels } = this.parseMetricKey(key);
      const labelStr = labels ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` : '';
      lines.push(`${name}_total${labelStr} ${value}`);
    }
    
    // Gauges
    for (const [key, value] of this.gauges) {
      const { name, labels } = this.parseMetricKey(key);
      const labelStr = labels ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` : '';
      lines.push(`${name}${labelStr} ${value}`);
    }
    
    // Histograms
    for (const [key] of this.histograms) {
      const { name, labels } = this.parseMetricKey(key);
      const stats = this.getHistogramStats(name, labels);
      if (stats) {
        const labelStr = labels ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` : '';
        lines.push(`${name}_count${labelStr} ${stats.count}`);
        lines.push(`${name}_sum${labelStr} ${stats.sum}`);
        lines.push(`${name}_bucket{le="95"${labels ? `,${  Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}` : ''}} ${stats.p95}`);
        lines.push(`${name}_bucket{le="99"${labels ? `,${  Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}` : ''}} ${stats.p99}`);
      }
    }
    
    return lines.join('\n');
  }

  private recordMetric(metric: Metric): void {
    const key = metric.name;
    const metrics = this.metrics.get(key) || [];
    
    metrics.push(metric);
    
    // Keep only recent metrics
    if (metrics.length > this.maxMetricsHistory) {
      metrics.splice(0, metrics.length - this.maxMetricsHistory);
    }
    
    this.metrics.set(key, metrics);
    
    // Emit metric event for real-time monitoring
    this.emit('metric', metric);
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    
    return `${name}{${labelStr}}`;
  }

  private parseMetricKey(key: string): { name: string; labels?: Record<string, string> } {
    const match = key.match(/^([^{]+)(?:\{(.+)\})?$/);
    if (!match) return { name: key };
    
    const [, name, labelStr] = match;
    if (!labelStr) return { name };
    
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(',')) {
      const [k, v] = pair.split('=');
      labels[k] = v;
    }
    
    return { name, labels };
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.metricsRetentionMs;
    
    for (const [key, metrics] of this.metrics) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      if (filtered.length !== metrics.length) {
        this.metrics.set(key, filtered);
      }
    }
    
    logger.debug('Cleaned up old metrics');
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.removeAllListeners();
  }
}

export const metricsCollector = new MetricsCollector();