/**
 * Type-safe configuration with compile-time validation
 * Using TypeScript's satisfies operator for strict type checking
 */

import { Environment, LogLevel } from '../shared/enums';
import type { ApplicationConfig, LegacyConfig } from './types';
import { ConfigurationConstraints } from './types';

/**
 * Parse environment variable as number with validation
 */
function parseNumber(
  envVar: string | undefined,
  defaultValue: number,
  constraints?: { min: number; max: number }
): number {
  const value = envVar ? Number(envVar) : defaultValue;

  if (isNaN(value)) {
    console.warn(`Invalid number value for environment variable: ${envVar}`);
    return defaultValue;
  }

  if (constraints) {
    if (value < constraints.min || value > constraints.max) {
      console.warn(`Value ${value} is outside constraints [${constraints.min}, ${constraints.max}]`);
      return defaultValue;
    }
  }

  return value;
}

/**
 * Parse environment variable as boolean
 */
function parseBoolean(envVar: string | undefined, defaultValue: boolean): boolean {
  if (envVar === undefined) return defaultValue;
  return envVar.toLowerCase() === 'true';
}

/**
 * Validate log level
 */
function validateLogLevel(level: string): `${LogLevel}` {
  const validLevels: `${LogLevel}`[] = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];

  if (validLevels.includes(level as `${LogLevel}`)) {
    return level as `${LogLevel}`;
  }

  console.warn(`Invalid log level: ${level}, defaulting to 'info'`);
  return LogLevel.INFO;
}

/**
 * Validate environment
 */
function validateEnvironment(env: string): `${Environment}` {
  const validEnvironments: `${Environment}`[] = [
    Environment.DEVELOPMENT,
    Environment.STAGING,
    Environment.PRODUCTION,
    Environment.TEST,
  ];

  if (validEnvironments.includes(env as `${Environment}`)) {
    return env as `${Environment}`;
  }

  console.warn(`Invalid environment: ${env}, defaulting to 'development'`);
  return Environment.DEVELOPMENT;
}

/**
 * Legacy configuration object (deprecated)
 * @deprecated Use ValidatedConfiguration instead
 */
export const config = {
  cache: {
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    enabled: true,
  },
  api: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    },
  },
} as const satisfies LegacyConfig;

/**
 * Type-safe validated configuration object
 * This uses the satisfies operator to ensure compile-time type checking
 */
export const ValidatedConfiguration = {
  server: {
    port: parseNumber(process.env.PORT, 3000, ConfigurationConstraints.server.port),
    nodeEnv: validateEnvironment(process.env.NODE_ENV ?? 'development'),
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    cacheTtl: parseNumber(process.env.CACHE_TTL, 300, ConfigurationConstraints.redis.cacheTtl),
  },
  apis: {
    wandererKills: {
      url: process.env.WANDERER_KILLS_URL ?? 'ws://localhost:4004',
    },
    map: {
      url: process.env.MAP_API_URL ?? 'https://api.eve-map.net',
      key: process.env.MAP_API_KEY ?? '',
      name: process.env.MAP_NAME,
    },
    esi: {
      baseUrl: process.env.ESI_BASE_URL ?? 'https://esi.evetech.net/latest',
    },
    zkillboard: {
      baseUrl: process.env.ZKILLBOARD_BASE_URL ?? 'https://zkillboard.com/api',
    },
  },
  http: {
    timeout: parseNumber(process.env.HTTP_TIMEOUT, 30000, ConfigurationConstraints.http.timeout),
    maxRetries: parseNumber(process.env.HTTP_MAX_RETRIES, 3, ConfigurationConstraints.http.maxRetries),
    initialRetryDelay: parseNumber(
      process.env.HTTP_INITIAL_RETRY_DELAY,
      1000,
      ConfigurationConstraints.http.initialRetryDelay
    ),
    maxRetryDelay: parseNumber(process.env.HTTP_MAX_RETRY_DELAY, 45000, ConfigurationConstraints.http.maxRetryDelay),
  },
  rateLimit: {
    minDelay: parseNumber(process.env.RATE_LIMIT_MIN_DELAY, 1000, ConfigurationConstraints.rateLimit.minDelay),
    maxDelay: parseNumber(process.env.RATE_LIMIT_MAX_DELAY, 10000, ConfigurationConstraints.rateLimit.maxDelay),
  },
  features: {
    newChartRendering: parseBoolean(process.env.FEATURE_NEW_CHART_RENDERING, false),
    redisCache: parseBoolean(process.env.FEATURE_REDIS_CACHE, true),
    newIngestionService: parseBoolean(process.env.FEATURE_NEW_INGESTION_SERVICE, false),
    awoxDetection: parseBoolean(process.env.FEATURE_AWOX_DETECTION, false),
  },
  logging: {
    level: validateLogLevel(process.env.LOG_LEVEL ?? 'info'),
  },
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
  },
  websocket: {
    url: process.env.WANDERER_KILLS_URL ?? 'ws://localhost:4004',
    reconnectIntervalMs: parseNumber(
      process.env.WEBSOCKET_RECONNECT_INTERVAL_MS,
      5000,
      ConfigurationConstraints.websocket.reconnectIntervalMs
    ),
    maxReconnectAttempts: parseNumber(
      process.env.WEBSOCKET_MAX_RECONNECT_ATTEMPTS,
      10,
      ConfigurationConstraints.websocket.maxReconnectAttempts
    ),
    timeout: parseNumber(process.env.WEBSOCKET_TIMEOUT, 10000, ConfigurationConstraints.websocket.timeout),
    preload: {
      enabled: parseBoolean(process.env.WEBSOCKET_PRELOAD_ENABLED, true),
      limitPerSystem: parseNumber(
        process.env.WEBSOCKET_PRELOAD_LIMIT_PER_SYSTEM,
        100,
        ConfigurationConstraints.websocket.preload.limitPerSystem
      ),
      sinceHours: parseNumber(
        process.env.WEBSOCKET_PRELOAD_SINCE_HOURS,
        168,
        ConfigurationConstraints.websocket.preload.sinceHours
      ),
      deliveryBatchSize: parseNumber(
        process.env.WEBSOCKET_PRELOAD_DELIVERY_BATCH_SIZE,
        10,
        ConfigurationConstraints.websocket.preload.deliveryBatchSize
      ),
      deliveryIntervalMs: parseNumber(
        process.env.WEBSOCKET_PRELOAD_DELIVERY_INTERVAL_MS,
        1000,
        ConfigurationConstraints.websocket.preload.deliveryIntervalMs
      ),
    },
  },
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
  charts: {
    defaultWidth: parseNumber(process.env.CHART_DEFAULT_WIDTH, 800, ConfigurationConstraints.charts.defaultWidth),
    defaultHeight: parseNumber(process.env.CHART_DEFAULT_HEIGHT, 600, ConfigurationConstraints.charts.defaultHeight),
    defaultCacheTTLSeconds: parseNumber(
      process.env.CHART_DEFAULT_CACHE_TTL_SECONDS,
      3600,
      ConfigurationConstraints.charts.defaultCacheTTLSeconds
    ),
    defaultTopLimit: parseNumber(
      process.env.CHART_DEFAULT_TOP_LIMIT,
      10,
      ConfigurationConstraints.charts.defaultTopLimit
    ),
  },
  bigIntConstants: {
    zero: BigInt(0),
  },
  jitter: {
    maxMs: parseNumber(process.env.JITTER_MAX_MS, 1000, ConfigurationConstraints.jitter.maxMs),
  },
} as const satisfies ApplicationConfig;

/**
 * Export individual configuration values for backward compatibility
 * @deprecated Use ValidatedConfiguration object instead
 */
export const REDIS_URL = ValidatedConfiguration.redis.url;
export const CACHE_TTL = ValidatedConfiguration.redis.cacheTtl;
export const ESI_BASE_URL = ValidatedConfiguration.apis.esi.baseUrl;
export const ZKILLBOARD_BASE_URL = ValidatedConfiguration.apis.zkillboard.baseUrl;
export const DATABASE_URL = ValidatedConfiguration.database.url;
export const HTTP_TIMEOUT = ValidatedConfiguration.http.timeout;
export const HTTP_MAX_RETRIES = ValidatedConfiguration.http.maxRetries;
export const HTTP_INITIAL_RETRY_DELAY = ValidatedConfiguration.http.initialRetryDelay;
export const HTTP_MAX_RETRY_DELAY = ValidatedConfiguration.http.maxRetryDelay;
export const RATE_LIMIT_MIN_DELAY = ValidatedConfiguration.rateLimit.minDelay;
export const RATE_LIMIT_MAX_DELAY = ValidatedConfiguration.rateLimit.maxDelay;
export const NEW_CHART_RENDERING = ValidatedConfiguration.features.newChartRendering;
export const PORT = ValidatedConfiguration.server.port;
export const NODE_ENV = ValidatedConfiguration.server.nodeEnv;
export const LOG_LEVEL = ValidatedConfiguration.logging.level;
export const DISCORD_BOT_TOKEN = ValidatedConfiguration.discord.token;
export const MAP_API_URL = ValidatedConfiguration.apis.map.url;
export const MAP_API_KEY = ValidatedConfiguration.apis.map.key;
export const MAP_NAME = ValidatedConfiguration.apis.map.name;
export const WANDERER_KILLS_URL = ValidatedConfiguration.apis.wandererKills.url;
export const MAX_RETRIES = ValidatedConfiguration.http.maxRetries;
export const RETRY_DELAY = ValidatedConfiguration.http.initialRetryDelay;
export const SENTRY_DSN = ValidatedConfiguration.sentry.dsn;
export const FEATURE_FLAGS = ValidatedConfiguration.features;

/**
 * Re-export the Configuration object for backward compatibility
 * @deprecated Use ValidatedConfiguration instead
 */
export const Configuration = ValidatedConfiguration;

/**
 * Export type definitions
 */
export type ConfigurationType = typeof ValidatedConfiguration;
export type ServerConfig = ConfigurationType['server'];
export type DatabaseConfig = ConfigurationType['database'];
export type RedisConfig = ConfigurationType['redis'];
export type ApiConfig = ConfigurationType['apis'];
export type HttpConfig = ConfigurationType['http'];
export type RateLimitConfig = ConfigurationType['rateLimit'];
export type FeatureFlags = ConfigurationType['features'];
export type LoggingConfig = ConfigurationType['logging'];
export type DiscordConfig = ConfigurationType['discord'];
export type SentryConfig = ConfigurationType['sentry'];
