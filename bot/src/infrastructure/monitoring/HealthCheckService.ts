import { PrismaClient } from '@prisma/client';
import { redis } from '../cache/redis-client';
import { logger } from '../../lib/logger';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    discord: ServiceHealth;
    websocket: ServiceHealth;
  };
  system: {
    memory: NodeJS.MemoryUsage;
    cpu: number;
    loadAverage: number[];
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  lastCheck: string;
  error?: string;
}

export class HealthCheckService {
  private prisma: PrismaClient;
  private cachedHealthStatus: HealthStatus | null = null;
  private lastHealthCheck = 0;
  private readonly healthCacheDuration = 10000; // 10 seconds

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const now = Date.now();

    // Return cached status if within cache duration
    if (this.cachedHealthStatus && now - this.lastHealthCheck < this.healthCacheDuration) {
      return this.cachedHealthStatus;
    }

    try {
      const [databaseHealth, redisHealth, discordHealth, websocketHealth] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkDiscord(),
        this.checkWebSocket(),
      ]);

      const services = {
        database: this.extractHealthResult(databaseHealth),
        redis: this.extractHealthResult(redisHealth),
        discord: this.extractHealthResult(discordHealth),
        websocket: this.extractHealthResult(websocketHealth),
      };

      // Determine overall status
      const serviceStatuses = Object.values(services).map(s => s.status);
      const overallStatus = this.determineOverallStatus(serviceStatuses);

      const healthStatus: HealthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services,
        system: {
          memory: process.memoryUsage(),
          cpu: process.cpuUsage().user / 1000000, // Convert to seconds
          loadAverage: require('os').loadavg(),
        },
      };

      this.cachedHealthStatus = healthStatus;
      this.lastHealthCheck = now;

      return healthStatus;
    } catch (error) {
      logger.error('Error performing health check:', error);

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: {
            status: 'unhealthy',
            responseTime: 0,
            lastCheck: new Date().toISOString(),
            error: 'Health check failed',
          },
          redis: {
            status: 'unhealthy',
            responseTime: 0,
            lastCheck: new Date().toISOString(),
            error: 'Health check failed',
          },
          discord: {
            status: 'unhealthy',
            responseTime: 0,
            lastCheck: new Date().toISOString(),
            error: 'Health check failed',
          },
          websocket: {
            status: 'unhealthy',
            responseTime: 0,
            lastCheck: new Date().toISOString(),
            error: 'Health check failed',
          },
        },
        system: {
          memory: process.memoryUsage(),
          cpu: 0,
          loadAverage: [0, 0, 0],
        },
      };
    }
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      await redis.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime < 500 ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  private async checkDiscord(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      // Check if Discord client is available and ready
      // This would need to be implemented based on your Discord client setup
      const isDiscordReady = process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN.length > 0;

      const responseTime = Date.now() - startTime;

      return {
        status: isDiscordReady ? 'healthy' : 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        error: isDiscordReady ? undefined : 'Discord token not configured',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Discord service check failed',
      };
    }
  }

  private async checkWebSocket(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      // Check WebSocket connection health
      // This would need to be implemented based on your WebSocket setup
      const websocketUrl = process.env.WANDERER_KILLS_URL;
      const isWebSocketConfigured = websocketUrl && websocketUrl.length > 0;

      const responseTime = Date.now() - startTime;

      return {
        status: isWebSocketConfigured ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date().toISOString(),
        error: isWebSocketConfigured ? undefined : 'WebSocket URL not configured',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'WebSocket service check failed',
      };
    }
  }

  private extractHealthResult(result: PromiseSettledResult<ServiceHealth>): ServiceHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'unhealthy',
        responseTime: 0,
        lastCheck: new Date().toISOString(),
        error: result.reason?.message || 'Service check failed',
      };
    }
  }

  private determineOverallStatus(
    serviceStatuses: Array<'healthy' | 'unhealthy' | 'degraded'>
  ): 'healthy' | 'unhealthy' | 'degraded' {
    if (serviceStatuses.every(status => status === 'healthy')) {
      return 'healthy';
    } else if (serviceStatuses.some(status => status === 'unhealthy')) {
      return 'unhealthy';
    } else {
      return 'degraded';
    }
  }

  async getReadinessStatus(): Promise<{ ready: boolean; services: string[] }> {
    const health = await this.getHealthStatus();
    const criticalServices = ['database', 'redis'];

    const readyServices = criticalServices.filter(
      service => health.services[service as keyof typeof health.services].status !== 'unhealthy'
    );

    return {
      ready: readyServices.length === criticalServices.length,
      services: readyServices,
    };
  }

  async getLivenessStatus(): Promise<{ alive: boolean; uptime: number }> {
    return {
      alive: true,
      uptime: process.uptime(),
    };
  }
}
