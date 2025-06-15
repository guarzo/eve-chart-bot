import express from 'express';
import { Server } from 'http';
import { HealthCheckService } from './HealthCheckService';
import { metricsCollector } from './MetricsCollector';
import { tracingService } from './TracingService';
import { chartCacheService } from '../../services/charts/cache/ChartCacheService';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger';

export class MonitoringServer {
  private app: express.Application;
  private server: Server | null = null;
  private healthCheckService: HealthCheckService;
  private port: number;

  constructor(prisma: PrismaClient, port = 3001) {
    this.app = express();
    this.healthCheckService = new HealthCheckService(prisma);
    this.port = port;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Basic middleware
    this.app.use(express.json());
    
    // CORS for monitoring tools
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    // Request logging with correlation ID
    this.app.use((req, res, next) => {
      const correlationId = tracingService.createCorrelationId();
      req.correlationId = correlationId;
      res.setHeader('X-Correlation-ID', correlationId);
      
      logger.info('Monitoring request', {
        correlationId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
      });
      
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoints
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.healthCheckService.getHealthStatus();
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(health);
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          error: 'Health check failed',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Readiness probe (for Kubernetes)
    this.app.get('/ready', async (req, res) => {
      try {
        const readiness = await this.healthCheckService.getReadinessStatus();
        const statusCode = readiness.ready ? 200 : 503;
        
        res.status(statusCode).json(readiness);
      } catch (error) {
        logger.error('Readiness check failed:', error);
        res.status(503).json({
          ready: false,
          error: 'Readiness check failed',
        });
      }
    });

    // Liveness probe (for Kubernetes)
    this.app.get('/live', async (req, res) => {
      try {
        const liveness = await this.healthCheckService.getLivenessStatus();
        res.json(liveness);
      } catch (error) {
        logger.error('Liveness check failed:', error);
        res.status(503).json({
          alive: false,
          error: 'Liveness check failed',
        });
      }
    });

    // Metrics endpoint (Prometheus format)
    this.app.get('/metrics', async (req, res) => {
      try {
        const prometheusMetrics = metricsCollector.getPrometheusMetrics();
        res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(prometheusMetrics);
      } catch (error) {
        logger.error('Metrics generation failed:', error);
        res.status(500).json({
          error: 'Metrics generation failed',
        });
      }
    });

    // Detailed metrics endpoint (JSON format)
    this.app.get('/metrics/json', async (req, res) => {
      try {
        const snapshot = await metricsCollector.getMetricsSnapshot();
        res.json(snapshot);
      } catch (error) {
        logger.error('Metrics snapshot failed:', error);
        res.status(500).json({
          error: 'Metrics snapshot failed',
        });
      }
    });

    // Tracing endpoints
    this.app.get('/traces', (req, res) => {
      try {
        const { traceId } = req.query;
        const traces = tracingService.exportJaegerTraces(traceId as string);
        res.json({
          data: traces,
          total: traces.length,
          traceId: traceId || null,
        });
      } catch (error) {
        logger.error('Traces export failed:', error);
        res.status(500).json({
          error: 'Traces export failed',
        });
      }
    });

    this.app.get('/traces/stats', (req, res) => {
      try {
        const stats = tracingService.getTraceStats();
        res.json(stats);
      } catch (error) {
        logger.error('Trace stats failed:', error);
        res.status(500).json({
          error: 'Trace stats failed',
        });
      }
    });

    // Cache stats endpoint
    this.app.get('/cache/stats', async (req, res) => {
      try {
        const stats = await chartCacheService.getCacheStats();
        res.json(stats);
      } catch (error) {
        logger.error('Cache stats failed:', error);
        res.status(500).json({
          error: 'Cache stats failed',
        });
      }
    });

    // Cache invalidation endpoint
    this.app.post('/cache/invalidate', async (req, res) => {
      try {
        const { type, characterIds, startDate, endDate } = req.body;
        
        switch (type) {
          case 'character':
            if (!characterIds) {
              return res.status(400).json({ error: 'characterIds required for character invalidation' });
            }
            await chartCacheService.invalidateCharacterCache(characterIds);
            break;
          
          case 'timeRange':
            if (!startDate) {
              return res.status(400).json({ error: 'startDate required for timeRange invalidation' });
            }
            await chartCacheService.invalidateTimeRangeCache(new Date(startDate), endDate ? new Date(endDate) : undefined);
            break;
          
          default:
            return res.status(400).json({ error: 'Invalid invalidation type. Use "character" or "timeRange"' });
        }
        
        res.json({ success: true, type, invalidatedAt: new Date().toISOString() });
      } catch (error) {
        logger.error('Cache invalidation failed:', error);
        res.status(500).json({
          error: 'Cache invalidation failed',
        });
      }
    });

    // Debug endpoints (only in development)
    if (process.env.NODE_ENV === 'development') {
      this.app.get('/debug/memory', (req, res) => {
        const memoryUsage = process.memoryUsage();
        const formattedMemory = {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
          arrayBuffers: `${Math.round(memoryUsage.arrayBuffers / 1024 / 1024)} MB`,
        };
        
        res.json({
          memory: formattedMemory,
          raw: memoryUsage,
          uptime: process.uptime(),
          cpuUsage: process.cpuUsage(),
        });
      });

      this.app.get('/debug/gc', (req, res) => {
        if (global.gc) {
          const beforeMemory = process.memoryUsage();
          global.gc();
          const afterMemory = process.memoryUsage();
          
          res.json({
            message: 'Garbage collection forced',
            before: beforeMemory,
            after: afterMemory,
            freed: {
              heapUsed: beforeMemory.heapUsed - afterMemory.heapUsed,
              external: beforeMemory.external - afterMemory.external,
            },
          });
        } else {
          res.status(400).json({
            error: 'Garbage collection not exposed. Start with --expose-gc flag.',
          });
        }
      });
    }

    // Default route
    this.app.get('/', (req, res) => {
      res.json({
        service: 'EVE Online Discord Bot - Monitoring',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          readiness: '/ready',
          liveness: '/live',
          metrics: '/metrics',
          metricsJson: '/metrics/json',
          traces: '/traces',
          traceStats: '/traces/stats',
          cacheStats: '/cache/stats',
          cacheInvalidation: 'POST /cache/invalidate',
        },
      });
    });

    // Error handling
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Monitoring server error:', {
        error: error.message,
        stack: error.stack,
        correlationId: req.correlationId,
        url: req.url,
        method: req.method,
      });

      res.status(500).json({
        error: 'Internal server error',
        correlationId: req.correlationId,
        timestamp: new Date().toISOString(),
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        correlationId: req.correlationId,
        timestamp: new Date().toISOString(),
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          logger.info(`Monitoring server started on port ${this.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error('Monitoring server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server!.close((error) => {
          if (error) {
            logger.error('Error stopping monitoring server:', error);
            reject(error);
          } else {
            logger.info('Monitoring server stopped');
            resolve();
          }
        });
      });
    }
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}