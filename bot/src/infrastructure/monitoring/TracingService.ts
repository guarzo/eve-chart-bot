import { randomUUID } from 'crypto';
import { logger } from '../../lib/logger';
import { AsyncLocalStorage } from 'async_hooks';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    level: string;
    message: string;
    fields?: Record<string, any>;
  }>;
  error?: Error;
}

export interface SpanOptions {
  operation: string;
  tags?: Record<string, any>;
  parentSpan?: TraceContext;
}

export class TracingService {
  private static instance: TracingService;
  private asyncLocalStorage = new AsyncLocalStorage<TraceContext>();
  private spans = new Map<string, TraceContext>();
  private readonly maxSpans = 10000;
  private readonly spanRetentionMs = 3600000; // 1 hour
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Clean up old spans periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldSpans();
    }, 300000).unref(); // Every 5 minutes, don't block process exit
  }

  static getInstance(): TracingService {
    if (!TracingService.instance) {
      TracingService.instance = new TracingService();
    }
    return TracingService.instance;
  }

  // Start a new trace
  startTrace(operation: string, tags?: Record<string, any>): TraceContext {
    const traceId = randomUUID();
    const spanId = randomUUID();
    
    const span: TraceContext = {
      traceId,
      spanId,
      operation,
      startTime: Date.now(),
      tags: tags || {},
      logs: [],
    };

    this.spans.set(spanId, span);
    return span;
  }

  // Start a child span
  startSpan(options: SpanOptions): TraceContext {
    const parentSpan = options.parentSpan || this.getCurrentSpan();
    const spanId = randomUUID();
    
    const span: TraceContext = {
      traceId: parentSpan?.traceId || randomUUID(),
      spanId,
      parentSpanId: parentSpan?.spanId,
      operation: options.operation,
      startTime: Date.now(),
      tags: options.tags || {},
      logs: [],
    };

    this.spans.set(spanId, span);
    return span;
  }

  // Finish a span
  finishSpan(span: TraceContext, error?: Error): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.error = error;

    // Log span completion
    this.logToSpan(span, 'info', 'Span completed', {
      duration: span.duration,
      success: !error,
    });

    // Emit trace event for monitoring
    this.emitTraceEvent(span);

    // Log trace information
    if (error) {
      logger.error(`Trace ${span.traceId} - ${span.operation} failed`, {
        traceId: span.traceId,
        spanId: span.spanId,
        duration: span.duration,
        error: error.message,
        stack: error.stack,
      });
    } else {
      logger.info(`Trace ${span.traceId} - ${span.operation} completed`, {
        traceId: span.traceId,
        spanId: span.spanId,
        duration: span.duration,
      });
    }
  }

  // Execute function within span context
  async executeInSpan<T>(
    options: SpanOptions,
    fn: (span: TraceContext) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(options);
    
    return this.asyncLocalStorage.run(span, async () => {
      try {
        const result = await fn(span);
        this.finishSpan(span);
        return result;
      } catch (error) {
        this.finishSpan(span, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    });
  }

  // Get current span from async context
  getCurrentSpan(): TraceContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  // Add tags to a span
  addTags(span: TraceContext, tags: Record<string, any>): void {
    Object.assign(span.tags, tags);
  }

  // Log to a span
  logToSpan(span: TraceContext, level: string, message: string, fields?: Record<string, any>): void {
    span.logs.push({
      timestamp: Date.now(),
      level,
      message,
      fields,
    });
  }

  // Get span by ID
  getSpan(spanId: string): TraceContext | undefined {
    return this.spans.get(spanId);
  }

  // Get all spans for a trace
  getTraceSpans(traceId: string): TraceContext[] {
    return Array.from(this.spans.values()).filter(span => span.traceId === traceId);
  }

  // Get trace statistics
  getTraceStats(): {
    totalSpans: number;
    activeSpans: number;
    completedSpans: number;
    errorSpans: number;
    averageDuration: number;
  } {
    const allSpans = Array.from(this.spans.values());
    const completedSpans = allSpans.filter(span => span.endTime);
    const errorSpans = allSpans.filter(span => span.error);
    const activeDurations = completedSpans.map(span => span.duration || 0);
    const averageDuration = activeDurations.length > 0 
      ? activeDurations.reduce((a, b) => a + b, 0) / activeDurations.length 
      : 0;

    return {
      totalSpans: allSpans.length,
      activeSpans: allSpans.length - completedSpans.length,
      completedSpans: completedSpans.length,
      errorSpans: errorSpans.length,
      averageDuration,
    };
  }

  // Export traces in Jaeger format
  exportJaegerTraces(traceId?: string): any[] {
    const spans = traceId 
      ? this.getTraceSpans(traceId)
      : Array.from(this.spans.values());

    return spans.map(span => ({
      traceID: span.traceId,
      spanID: span.spanId,
      parentSpanID: span.parentSpanId || '',
      operationName: span.operation,
      startTime: span.startTime * 1000, // Convert to microseconds
      duration: (span.duration || 0) * 1000, // Convert to microseconds
      tags: Object.entries(span.tags).map(([key, value]) => ({
        key,
        type: typeof value === 'string' ? 'string' : 'number',
        value: String(value),
      })),
      logs: span.logs.map(log => ({
        timestamp: log.timestamp * 1000, // Convert to microseconds
        fields: [
          { key: 'level', value: log.level },
          { key: 'message', value: log.message },
          ...(log.fields ? Object.entries(log.fields).map(([key, value]) => ({
            key,
            value: String(value),
          })) : []),
        ],
      })),
      process: {
        serviceName: 'eve-discord-bot',
        tags: [
          { key: 'hostname', value: require('os').hostname() },
          { key: 'pid', value: String(process.pid) },
          { key: 'version', value: process.env.npm_package_version || '1.0.0' },
        ],
      },
    }));
  }

  // Create correlation ID for requests
  createCorrelationId(): string {
    return randomUUID();
  }

  // Instrument Discord commands
  instrumentDiscordCommand<T>(
    commandName: string,
    userId: string,
    guildId: string,
    fn: (span: TraceContext) => Promise<T>
  ): Promise<T> {
    return this.executeInSpan({
      operation: `discord.command.${commandName}`,
      tags: {
        'discord.command': commandName,
        'discord.user_id': userId,
        'discord.guild_id': guildId,
        'service.name': 'discord-bot',
      },
    }, fn);
  }

  // Instrument database operations
  instrumentDatabaseOperation<T>(
    operation: string,
    table: string,
    fn: (span: TraceContext) => Promise<T>
  ): Promise<T> {
    return this.executeInSpan({
      operation: `db.${operation}`,
      tags: {
        'db.type': 'postgresql',
        'db.table': table,
        'db.operation': operation,
      },
    }, fn);
  }

  // Instrument chart generation
  instrumentChartGeneration<T>(
    chartType: string,
    characterCount: number,
    fn: (span: TraceContext) => Promise<T>
  ): Promise<T> {
    return this.executeInSpan({
      operation: `chart.generate.${chartType}`,
      tags: {
        'chart.type': chartType,
        'chart.character_count': characterCount,
        'service.name': 'chart-service',
      },
    }, fn);
  }

  // Instrument HTTP requests
  instrumentHttpRequest<T>(
    method: string,
    url: string,
    fn: (span: TraceContext) => Promise<T>
  ): Promise<T> {
    return this.executeInSpan({
      operation: `http.${method.toLowerCase()}`,
      tags: {
        'http.method': method,
        'http.url': url,
        'component': 'http-client',
      },
    }, fn);
  }

  private emitTraceEvent(span: TraceContext): void {
    // This could emit to an external tracing system like Jaeger or Zipkin
    // For now, we'll just log it
    logger.debug('Trace event emitted', {
      traceId: span.traceId,
      spanId: span.spanId,
      operation: span.operation,
      duration: span.duration,
      success: !span.error,
    });
  }

  /**
   * Destroy the tracing service and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.spans.clear();
    logger.info('TracingService destroyed');
  }

  private cleanupOldSpans(): void {
    const cutoff = Date.now() - this.spanRetentionMs;
    const toDelete: string[] = [];

    for (const [spanId, span] of this.spans) {
      if (span.endTime && span.endTime < cutoff) {
        toDelete.push(spanId);
      }
    }

    for (const spanId of toDelete) {
      this.spans.delete(spanId);
    }

    // If we still have too many spans, remove the oldest ones
    if (this.spans.size > this.maxSpans) {
      const sortedSpans = Array.from(this.spans.entries())
        .sort(([, a], [, b]) => a.startTime - b.startTime);
      
      const excessCount = this.spans.size - this.maxSpans;
      for (let i = 0; i < excessCount; i++) {
        this.spans.delete(sortedSpans[i][0]);
      }
    }

    if (toDelete.length > 0) {
      logger.debug(`Cleaned up ${toDelete.length} old spans`);
    }
  }
}

export const tracingService = TracingService.getInstance();