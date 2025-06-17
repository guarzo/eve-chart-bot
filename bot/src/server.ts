import 'reflect-metadata';
import { startupProfiler } from './utils/startupProfiler';
startupProfiler.checkpoint('After reflect-metadata');

import express, { RequestHandler } from 'express';
import { logger } from './lib/logger';
import { WebSocketIngestionService } from './services/ingestion/WebSocketIngestionService';
import { config as dotenvConfig } from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import { DiscordClient } from './lib/discord/client';
import { commands } from './lib/discord/commands';
import { ChartServiceFactory, destroyChartWorkerManager } from './services/charts';
import { ChartRenderer } from './services/ChartRenderer';
import { ChartConfigInput, ChartSourceType as ChartSourceTypeType, ChartPeriod as ChartPeriodType, ChartGroupBy as ChartGroupByType } from './types/chart';
import { z } from 'zod';
import { initSentry } from './lib/sentry';
import { MapActivityService } from './services/ingestion/MapActivityService';
import { CharacterSyncService } from './services/ingestion/CharacterSyncService';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ValidatedConfiguration as Configuration } from './config/validated';
import { PrismaClient } from '@prisma/client';
import { timerManager } from './shared/performance/timerManager';
import { rateLimiterManager } from './shared/performance/RateLimiterManager';
import { ChartPeriod, ChartSourceType, ChartGroupBy } from './shared/enums';
import { RepositoryManager } from './infrastructure/repositories/RepositoryManager';
import { metricsCollector } from './infrastructure/monitoring/MetricsCollector';
import { tracingService } from './infrastructure/monitoring/TracingService';
import { memoryMonitor } from './utils/memoryMonitor';
import { disconnectRedis } from './infrastructure/cache/redis-client';

const execAsync = promisify(exec);

startupProfiler.checkpoint('After imports');

// Load environment variables
dotenvConfig();
startupProfiler.checkpoint('After dotenv');

// Initialize Sentry
initSentry();
startupProfiler.checkpoint('After Sentry');

// Initialize Prisma
const prisma = new PrismaClient();
startupProfiler.checkpoint('After Prisma client');

// Initialize RepositoryManager with the shared PrismaClient
const repositoryManager = RepositoryManager.getInstance(prisma);
startupProfiler.checkpoint('After RepositoryManager');

// Constants
const appStartTime = Date.now();
const port =
  Configuration.server.nodeEnv === 'test'
    ? 0 // Use random port for tests
    : Configuration.server.port;

// Create Express app
const app = express();
startupProfiler.checkpoint('After Express app');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  })
);
startupProfiler.checkpoint('After middleware');

// Initialize services
const websocketService = new WebSocketIngestionService(
  {
    url: Configuration.websocket.url,
    reconnectIntervalMs: Configuration.websocket.reconnectIntervalMs,
    maxReconnectAttempts: Configuration.websocket.maxReconnectAttempts,
    timeout: Configuration.websocket.timeout,
    preload: Configuration.websocket.preload,
  },
  prisma
);
startupProfiler.checkpoint('After WebSocketIngestionService');

const mapService = new MapActivityService(
  Configuration.apis.map.url,
  Configuration.apis.map.key,
  Configuration.redis.url,
  Configuration.redis.cacheTtl,
  Configuration.http.maxRetries,
  Configuration.http.initialRetryDelay
);
startupProfiler.checkpoint('After MapActivityService');

const characterService = new CharacterSyncService(
  Configuration.apis.map.url,
  Configuration.apis.map.key,
  Configuration.http.maxRetries,
  Configuration.http.initialRetryDelay
);
startupProfiler.checkpoint('After CharacterSyncService');

const chartServiceFactory = ChartServiceFactory.getInstance(prisma);
const chartService = chartServiceFactory.getMainChartService();
const chartRenderer = new ChartRenderer();
startupProfiler.checkpoint('After chart services');

// Initialize repositories from RepositoryManager
const characterRepository = repositoryManager.getCharacterRepository();
startupProfiler.checkpoint('After repositories');

// Initialize Discord client
const discordClient = new DiscordClient();
startupProfiler.checkpoint('After Discord client');

// Validation schemas
const chartConfigSchema = z.object({
  type: z.nativeEnum(ChartSourceType),
  characterIds: z.array(z.bigint()),
  period: z.nativeEnum(ChartPeriod),
  groupBy: z.nativeEnum(ChartGroupBy).optional(),
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Memory monitoring endpoint
app.get('/memory', (_req, res) => {
  const metrics = memoryMonitor.getMetrics();
  const memory = metrics.current;
  
  res.json({
    current: {
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
      external: `${Math.round(memory.external / 1024 / 1024)}MB`,
      arrayBuffers: `${Math.round(memory.arrayBuffers / 1024 / 1024)}MB`,
      heapPercent: `${((memory.heapUsed / memory.heapTotal) * 100).toFixed(1)  }%`
    },
    growthRate: `${metrics.heapGrowthRate.toFixed(2)}MB/min`,
    sampleCount: metrics.samples.length,
    uptime: process.uptime()
  });
});

// WebSocket service status endpoint
app.get('/api/websocket/status', (_req, res) => {
  const status = websocketService.getStatus();
  res.json(status);
});

// Character management endpoints
app.post('/api/characters/:characterId', async (req, res) => {
  try {
    const characterId = BigInt(req.params.characterId);
    const character = await characterRepository.upsertCharacter({
      eveId: characterId,
      name: req.body.name,
      corporationId: req.body.corporationId,
      corporationTicker: req.body.corporationTicker,
      allianceId: req.body.allianceId,
      allianceTicker: req.body.allianceTicker,
    });

    // Update WebSocket subscriptions
    await websocketService.updateCharacterSubscriptions([Number(characterId)]);

    res.json({ success: true, character });
  } catch (error) {
    logger.error('Failed to add character', error);
    res.status(500).json({ error: 'Failed to add character' });
  }
});

app.delete('/api/characters/:characterId', async (req, res) => {
  try {
    const characterId = BigInt(req.params.characterId);
    await characterRepository.deleteCharacter(characterId);

    // Update WebSocket subscriptions
    await websocketService.updateCharacterSubscriptions(undefined, [Number(characterId)]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to remove character', error);
    res.status(500).json({ error: 'Failed to remove character' });
  }
});

// Get available chart types
app.get('/v1/charts/types', (_req, res) => {
  res.json({
    types: [
      {
        id: ChartSourceType.KILLS,
        name: 'Kill Chart',
        description: 'Generate a chart showing kill activity',
        periods: [ChartPeriod.TWENTY_FOUR_HOURS, ChartPeriod.SEVEN_DAYS, ChartPeriod.THIRTY_DAYS, ChartPeriod.NINETY_DAYS],
        groupBy: [ChartGroupBy.HOUR, ChartGroupBy.DAY, ChartGroupBy.WEEK],
      },
      {
        id: ChartSourceType.MAP_ACTIVITY,
        name: 'Map Activity Chart',
        description: 'Generate a chart showing map activity',
        periods: [ChartPeriod.TWENTY_FOUR_HOURS, ChartPeriod.SEVEN_DAYS, ChartPeriod.THIRTY_DAYS],
        groupBy: [ChartGroupBy.HOUR, ChartGroupBy.DAY],
      },
    ],
  });
});

// Generate chart endpoint
app.post('/v1/charts/generate', (async (req, res) => {
  try {
    // Validate request
    const config = chartConfigSchema.parse(req.body);

    // Convert config to ChartConfigInput
    const chartConfig: ChartConfigInput = {
      type: config.type as ChartSourceTypeType,
      characterIds: config.characterIds,
      period: config.period as ChartPeriodType,
      groupBy: config.groupBy as ChartGroupByType | undefined,
    };

    // Generate chart data
    const chartData = await chartService.generateChart(chartConfig);

    // Render chart to buffer
    const buffer = await chartRenderer.renderToBuffer(chartData);

    // Send image
    res.contentType('image/png');
    res.send(buffer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      logger.error('Error generating chart:', error);
      res.status(500).json({ error: 'Failed to generate chart' });
    }
  }
}) as RequestHandler);

// Status endpoint
app.get('/status', (_req, res) => {
  const uptime = Math.floor((Date.now() - appStartTime) / 1000);
  const status = {
    uptime,
    services: {
      websocket: websocketService.getStatus(),
      discord: {
        connected: discordClient.isReady(),
        guilds: discordClient.getGuildsCount(),
      },
    },
    version: process.env.npm_package_version ?? 'unknown',
  };
  res.json(status);
});

// Diagnostics endpoints
app.get('/api/diagnostics/tracked-characters', async (_req, res) => {
  try {
    const characters = await characterRepository.getAllCharacters();
    res.json({
      count: characters.length,
      characters: characters.map(char => ({
        id: char.eveId.toString(),
        name: char.name,
        corporationId: char.corporationId,
        allianceId: char.allianceId,
      })),
    });
  } catch (error) {
    logger.error('Failed to get tracked characters', error);
    res.status(500).json({ error: 'Failed to get tracked characters' });
  }
});

app.get('/api/diagnostics/character-groups', async (_req, res) => {
  try {
    const groups = await characterRepository.getAllCharacterGroups();
    res.json({
      count: groups.length,
      groups: groups.map(group => ({
        id: group.id,
        mainCharacterId: group.mainCharacterId?.toString(),
        characterCount: group.characters.length,
        characters: group.characters.map(char => ({
          id: char.eveId.toString(),
          name: char.name,
        })),
      })),
    });
  } catch (error) {
    logger.error('Failed to get character groups', error);
    res.status(500).json({ error: 'Failed to get character groups' });
  }
});

// Start the server
async function startServer() {
  logger.info('Starting EVE Chart Bot server...');

  // Start memory monitoring if in development
  if (Configuration.server.nodeEnv === 'development') {
    memoryMonitor.start(5 * 60 * 1000); // Log every 5 minutes
  }

  startupProfiler.checkpoint('Before migrations');

  // Run database migrations
  logger.info('Running database migrations...');
  try {
    const { stderr } = await execAsync('npx prisma migrate deploy');
    if (stderr) {
      logger.warn('Migration warnings:', stderr);
    }
  } catch (error) {
    logger.error('Error running migrations:', error);
    throw error;
  }
  startupProfiler.checkpoint('After migrations');

  // Start services
  await characterService.start();
  await mapService.start();
  startupProfiler.checkpoint('After starting services');

  // Initialize WebSocket service
  await websocketService.start();
  startupProfiler.checkpoint('After WebSocket start');

  // Initialize Discord if token is available
  const discordToken = Configuration.discord.token;
  if (discordToken) {
    try {
      const discordStartTime = Date.now();
      logger.info(`Discord initialization starting... (${(discordStartTime - appStartTime) / 1000}s after app start)`);

      logger.debug('Found Discord token:', `${discordToken.substring(0, 10)}...`);

      // Login to Discord
      logger.info('Logging in to Discord...');
      await discordClient.login(discordToken);
      await discordClient.registerCommands(commands);
      const loginTime = Date.now();
      logger.info(
        `Discord login successful - Client ready state: ${
          discordClient.isReady() ? 'Ready' : 'Not Ready'
        } (${(loginTime - discordStartTime) / 1000}s)`
      );

      // Add specific Discord readiness log
      timerManager.setTimeout(() => {
        const readyCheckTime = Date.now();
        logger.info(
          `Discord client status check after 5 seconds: (Total time since app start: ${
            (readyCheckTime - appStartTime) / 1000
          }s)`,
          {
            ready: discordClient.isReady() ? 'Yes' : 'No',
            guilds: discordClient.getGuildsCount(),
          }
        );
      }, 5000);
    } catch (error) {
      logger.error('Failed to initialize Discord:', error);
      // Don't throw - allow server to continue without Discord
    }
  } else {
    logger.warn('Discord token not found, Discord integration will be disabled');
  }

  // Start Express server
  const server = app.listen(port, () => {
    const startupTime = (Date.now() - appStartTime) / 1000;
    logger.info(`Server is running on port ${port} (startup took ${startupTime}s)`);
    
    // Generate startup profiling report
    startupProfiler.checkpoint('Server started');
    startupProfiler.getReport();
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`);

    // Get timer stats before shutdown
    const timerStats = timerManager.getStats();
    logger.info('Timer statistics before shutdown:', timerStats);

    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Stop memory monitor
    memoryMonitor.stop();

    // Stop services
    await websocketService.stop();
    await mapService.close();
    await characterService.close();

    // Disconnect Discord
    if (discordClient.isReady()) {
      // Discord.js Client doesn't have destroy, just disconnect
      await discordClient.client.destroy();
    }

    // Clean up rate limiters
    rateLimiterManager.cleanup();

    // Clean up monitoring services
    metricsCollector.destroy();
    tracingService.destroy();

    // Clean up chart workers
    await destroyChartWorkerManager();
    
    // Disconnect Redis
    await disconnectRedis();

    // Clean up RepositoryManager (will disconnect Prisma)
    await RepositoryManager.resetInstance();

    logger.info('Shutdown complete');
    // Exit the process
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

// Export for testing
export { app, startServer };

// Start server if not in test mode
if (Configuration.server.nodeEnv !== 'test') {
  startServer().catch(error => {
    logger.error('Failed to start server:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  });
}
