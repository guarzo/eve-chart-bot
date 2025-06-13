// Configuration options for the application

export const config = {
  // Cache settings
  cache: {
    // Default TTL for cache entries in milliseconds
    defaultTTL: 5 * 60 * 1000, // 5 minutes

    // Whether to enable caching
    enabled: true,
  },

  // API settings
  api: {
    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    },
  },
};

// Environment-based configuration
export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
export const CACHE_TTL = Number(process.env.CACHE_TTL) || 300; // seconds
// Legacy URLs (to be removed)
export const ESI_BASE_URL =
  process.env.ESI_BASE_URL ?? "https://esi.evetech.net/latest";
export const ZKILLBOARD_BASE_URL =
  process.env.ZKILLBOARD_BASE_URL ?? "https://zkillboard.com/api";

// Database configuration
export const DATABASE_URL = process.env.DATABASE_URL;

// HTTP Client configuration
export const HTTP_TIMEOUT = Number(process.env.HTTP_TIMEOUT) || 30000; // 30 seconds
export const HTTP_MAX_RETRIES = Number(process.env.HTTP_MAX_RETRIES) || 3;
export const HTTP_INITIAL_RETRY_DELAY =
  Number(process.env.HTTP_INITIAL_RETRY_DELAY) || 1000; // 1 second
export const HTTP_MAX_RETRY_DELAY =
  Number(process.env.HTTP_MAX_RETRY_DELAY) || 45000; // 45 seconds

// Rate limiting configuration
export const RATE_LIMIT_MIN_DELAY =
  Number(process.env.RATE_LIMIT_MIN_DELAY) || 1000; // 1 second
export const RATE_LIMIT_MAX_DELAY =
  Number(process.env.RATE_LIMIT_MAX_DELAY) || 10000; // 10 seconds

// Feature flags
export const NEW_CHART_RENDERING = process.env.NEW_CHART_RENDERING === "true";

// Server configuration
export const PORT = Number(process.env.PORT) || 3000;
export const NODE_ENV = process.env.NODE_ENV || "development";

// Logging configuration
export const LOG_LEVEL = process.env.LOG_LEVEL || "info";

// Discord Bot Configuration
export const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Map API Configuration
export const MAP_API_URL = process.env.MAP_API_URL || "https://api.eve-map.net";
export const MAP_API_KEY = process.env.MAP_API_KEY || "";
export const MAP_NAME = process.env.MAP_NAME;

// WebSocket Configuration
export const WANDERER_KILLS_URL = process.env.WANDERER_KILLS_URL || "ws://localhost:4004";

// Retry Configuration
export const MAX_RETRIES = Number(process.env.MAX_RETRIES) || 3;
export const RETRY_DELAY = Number(process.env.RETRY_DELAY) || 5000; // 5 seconds

// Sentry Configuration
export const SENTRY_DSN = process.env.SENTRY_DSN;

// Feature Flags - Centralized boolean conversion
const getBooleanFlag = (
  envVar: string | undefined,
  defaultValue: boolean
): boolean => {
  if (envVar === undefined) return defaultValue;
  return envVar.toLowerCase() === "true";
};

export const FEATURE_FLAGS = {
  newChartRendering: getBooleanFlag(
    process.env.FEATURE_NEW_CHART_RENDERING,
    false
  ),
  redisCache: getBooleanFlag(process.env.FEATURE_REDIS_CACHE, true),
  newIngestionService: getBooleanFlag(
    process.env.FEATURE_NEW_INGESTION_SERVICE,
    false
  ),
  awoxDetection: getBooleanFlag(process.env.FEATURE_AWOX_DETECTION, false),
};

// Type-safe configuration object
export const Configuration = {
  server: {
    port: PORT,
    nodeEnv: NODE_ENV,
  },
  database: {
    url: DATABASE_URL,
  },
  redis: {
    url: REDIS_URL,
    cacheTtl: CACHE_TTL,
  },
  apis: {
    wandererKills: {
      url: WANDERER_KILLS_URL,
    },
    map: {
      url: MAP_API_URL,
      key: MAP_API_KEY,
      name: MAP_NAME,
    },
    // Legacy APIs (to be removed)
    esi: {
      baseUrl: ESI_BASE_URL,
    },
    zkillboard: {
      baseUrl: ZKILLBOARD_BASE_URL,
    },
  },
  http: {
    timeout: HTTP_TIMEOUT,
    maxRetries: HTTP_MAX_RETRIES,
    initialRetryDelay: HTTP_INITIAL_RETRY_DELAY,
    maxRetryDelay: HTTP_MAX_RETRY_DELAY,
  },
  rateLimit: {
    minDelay: RATE_LIMIT_MIN_DELAY,
    maxDelay: RATE_LIMIT_MAX_DELAY,
  },
  features: FEATURE_FLAGS,
  logging: {
    level: LOG_LEVEL,
  },
  discord: {
    token: DISCORD_BOT_TOKEN,
  },
  websocket: {
    url: WANDERER_KILLS_URL,
    reconnectIntervalMs: 5000,
    maxReconnectAttempts: 10,
    timeout: 10000,
    preload: {
      enabled: true,
      limitPerSystem: 100,
      sinceHours: 168, // 7 days
      deliveryBatchSize: 10,
      deliveryIntervalMs: 1000,
    },
  },
  sentry: {
    dsn: SENTRY_DSN,
  },
} as const;

// Type definitions for configuration
export type ConfigurationType = typeof Configuration;
export type ServerConfig = ConfigurationType["server"];
export type DatabaseConfig = ConfigurationType["database"];
export type RedisConfig = ConfigurationType["redis"];
export type ApiConfig = ConfigurationType["apis"];
export type HttpConfig = ConfigurationType["http"];
export type RateLimitConfig = ConfigurationType["rateLimit"];
export type FeatureFlags = ConfigurationType["features"];
export type LoggingConfig = ConfigurationType["logging"];
export type DiscordConfig = ConfigurationType["discord"];
export type SentryConfig = ConfigurationType["sentry"];
