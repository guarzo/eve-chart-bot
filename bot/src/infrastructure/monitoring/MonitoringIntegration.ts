import { PrismaClient } from '@prisma/client';
import { HealthCheckService } from './HealthCheckService';
import { metricsCollector } from './MetricsCollector';
import { tracingService } from './TracingService';
import { MonitoringServer } from './MonitoringServer';
import { logger } from '../../lib/logger';

export class MonitoringIntegration {
  private static instance: MonitoringIntegration;
  private healthCheckService: HealthCheckService;
  private monitoringServer: MonitoringServer | null = null;
  private isInitialized = false;

  private constructor(private prisma: PrismaClient) {
    this.healthCheckService = new HealthCheckService(prisma);
  }

  static getInstance(prisma: PrismaClient): MonitoringIntegration {
    if (!MonitoringIntegration.instance) {
      MonitoringIntegration.instance = new MonitoringIntegration(prisma);
    }
    return MonitoringIntegration.instance;
  }

  async initialize(options: {
    enableServer?: boolean;
    serverPort?: number;
    enableMetrics?: boolean;
    enableTracing?: boolean;
  } = {}): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const {
      enableServer = true,
      serverPort = 3001,
      enableMetrics = true,
      enableTracing = true,
    } = options;

    try {
      logger.info('Initializing monitoring integration...');

      // Start monitoring server if enabled
      if (enableServer) {
        this.monitoringServer = new MonitoringServer(this.prisma, serverPort);
        await this.monitoringServer.start();
      }

      // Set up Prisma middleware for database metrics
      if (enableMetrics) {
        this.setupPrismaMiddleware();
      }

      // Set up process metrics collection
      if (enableMetrics) {
        this.setupProcessMetrics();
      }

      // Set up error tracking
      this.setupErrorTracking();

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      this.isInitialized = true;
      logger.info('Monitoring integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize monitoring integration:', error);
      throw error;
    }
  }

  private setupPrismaMiddleware(): void {
    this.prisma.$use(async (params, next) => {
      const startTime = Date.now();
      
      try {
        const result = await tracingService.instrumentDatabaseOperation(
          params.action,
          params.model || 'unknown',
          async (span) => {
            tracingService.addTags(span, {
              'db.args': JSON.stringify(params.args).substring(0, 1000), // Limit size
            });
            
            const result = await next(params);
            
            metricsCollector.incrementCounter('database_queries', 1, {
              model: params.model || 'unknown',
              action: params.action,
              status: 'success',
            });
            
            return result;
          }
        );

        metricsCollector.recordTiming('database_query_duration', Date.now() - startTime, {
          model: params.model || 'unknown',
          action: params.action,
        });

        return result;
      } catch (error) {
        metricsCollector.incrementCounter('database_query_errors', 1, {
          model: params.model || 'unknown',
          action: params.action,
        });

        metricsCollector.recordTiming('database_query_duration', Date.now() - startTime, {
          model: params.model || 'unknown',
          action: params.action,
          status: 'error',
        });

        throw error;
      }
    });
  }

  private setupProcessMetrics(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // Memory metrics
      metricsCollector.setGauge('system_memory_rss', memoryUsage.rss);
      metricsCollector.setGauge('system_memory_heap_total', memoryUsage.heapTotal);
      metricsCollector.setGauge('system_memory_heap_used', memoryUsage.heapUsed);
      metricsCollector.setGauge('system_memory_external', memoryUsage.external);

      // CPU metrics
      metricsCollector.setGauge('system_cpu_user', cpuUsage.user);
      metricsCollector.setGauge('system_cpu_system', cpuUsage.system);

      // Process metrics
      metricsCollector.setGauge('system_uptime', process.uptime());
      metricsCollector.setGauge('system_load_average_1m', require('os').loadavg()[0]);
      metricsCollector.setGauge('system_load_average_5m', require('os').loadavg()[1]);
      metricsCollector.setGauge('system_load_average_15m', require('os').loadavg()[2]);

      // Event loop lag (rough approximation)
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
        metricsCollector.setGauge('event_loop_delay', lag);
      });
    }, 30000);

    // Collect garbage collection metrics if available
    if (process.env.NODE_ENV === 'development' && global.gc) {
      let lastGcTime = 0;
      const originalGc = global.gc;
      
      global.gc = (...args: any[]) => {
        const start = Date.now();
        const result = originalGc.apply(global, args);
        const duration = Date.now() - start;
        
        metricsCollector.incrementCounter('gc_runs');
        metricsCollector.recordTiming('gc_duration', duration);
        
        lastGcTime = start;
        return result;
      };
    }
  }

  private setupErrorTracking(): void {
    // Track uncaught exceptions
    process.on('uncaughtException', (error) => {
      metricsCollector.incrementCounter('uncaught_exceptions');
      logger.error('Uncaught exception:', error);
      
      // Don't exit immediately, let other handlers run
    });

    // Track unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      metricsCollector.incrementCounter('unhandled_rejections');
      logger.error('Unhandled promise rejection:', { reason, promise });
    });

    // Track warnings
    process.on('warning', (warning) => {
      metricsCollector.incrementCounter('process_warnings', 1, {
        name: warning.name,
      });
      logger.warn('Process warning:', warning);
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down monitoring gracefully...`);
      
      try {
        // Stop monitoring server
        if (this.monitoringServer) {
          await this.monitoringServer.stop();
        }

        // Cleanup metrics collector
        metricsCollector.destroy();

        logger.info('Monitoring shutdown completed');
      } catch (error) {
        logger.error('Error during monitoring shutdown:', error);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  // Helper methods for application integration
  
  async getApplicationHealth(): Promise<any> {
    return this.healthCheckService.getHealthStatus();
  }

  recordDiscordCommand(commandName: string, userId: string, guildId: string, duration: number, success: boolean): void {
    metricsCollector.incrementCounter('discord_commands_processed', 1, {
      command: commandName,
      status: success ? 'success' : 'error',
    });

    metricsCollector.recordTiming('discord_command_duration', duration, {
      command: commandName,
    });

    if (!success) {
      metricsCollector.incrementCounter('discord_command_errors', 1, {
        command: commandName,
      });
    }
  }

  recordWebSocketMessage(messageType: string, success: boolean): void {
    metricsCollector.incrementCounter('websocket_messages_received', 1, {
      type: messageType,
      status: success ? 'success' : 'error',
    });
  }

  recordChartGeneration(chartType: string, duration: number, cacheHit: boolean, success: boolean): void {
    metricsCollector.incrementCounter('chart_generations', 1, {
      type: chartType,
      cache_hit: cacheHit ? 'true' : 'false',
      status: success ? 'success' : 'error',
    });

    metricsCollector.recordTiming('chart_generation_duration', duration, {
      type: chartType,
    });

    if (cacheHit) {
      metricsCollector.incrementCounter('chart_cache_hits', 1, { type: chartType });
    } else {
      metricsCollector.incrementCounter('chart_cache_misses', 1, { type: chartType });
    }
  }

  setActiveConnections(count: number): void {
    metricsCollector.setGauge('active_connections', count);
  }

  setDatabaseConnectionPoolSize(size: number): void {
    metricsCollector.setGauge('database_connection_pool_size', size);
  }

  // Expose services for advanced usage
  getHealthCheckService(): HealthCheckService {
    return this.healthCheckService;
  }

  getMetricsCollector(): typeof metricsCollector {
    return metricsCollector;
  }

  getTracingService(): typeof tracingService {
    return tracingService;
  }
}