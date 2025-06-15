/**
 * Configuration type definitions with strict validation
 * Using TypeScript's satisfies operator for compile-time validation
 */

import { Environment, LogLevel } from '../shared/enums';

/**
 * Server configuration interface
 */
export interface ServerConfig {
  readonly port: number;
  readonly nodeEnv: `${Environment}`;
}

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  readonly url: string | undefined;
}

/**
 * Redis configuration interface
 */
export interface RedisConfig {
  readonly url: string;
  readonly cacheTtl: number;
}

/**
 * API endpoint configuration
 */
export interface ApiEndpointConfig {
  readonly url: string;
  readonly key?: string;
  readonly name?: string;
}

/**
 * Legacy API configuration (to be removed)
 */
export interface LegacyApiConfig {
  readonly baseUrl: string;
}

/**
 * APIs configuration interface
 */
export interface ApisConfig {
  readonly wandererKills: Pick<ApiEndpointConfig, 'url'>;
  readonly map: ApiEndpointConfig;
  readonly esi: LegacyApiConfig;
  readonly zkillboard: LegacyApiConfig;
}

/**
 * HTTP client configuration interface
 */
export interface HttpConfig {
  readonly timeout: number;
  readonly maxRetries: number;
  readonly initialRetryDelay: number;
  readonly maxRetryDelay: number;
}

/**
 * Rate limiting configuration interface
 */
export interface RateLimitConfig {
  readonly minDelay: number;
  readonly maxDelay: number;
}

/**
 * Feature flags configuration interface
 */
export interface FeatureFlagsConfig {
  readonly newChartRendering: boolean;
  readonly redisCache: boolean;
  readonly newIngestionService: boolean;
  readonly awoxDetection: boolean;
}

/**
 * Logging configuration interface
 */
export interface LoggingConfig {
  readonly level: `${LogLevel}`;
}

/**
 * Discord configuration interface
 */
export interface DiscordConfig {
  readonly token: string | undefined;
}

/**
 * WebSocket preload configuration
 */
export interface WebSocketPreloadConfig {
  readonly enabled: boolean;
  readonly limitPerSystem: number;
  readonly sinceHours: number;
  readonly deliveryBatchSize: number;
  readonly deliveryIntervalMs: number;
}

/**
 * WebSocket configuration interface
 */
export interface WebSocketConfig {
  readonly url: string;
  readonly reconnectIntervalMs: number;
  readonly maxReconnectAttempts: number;
  readonly timeout: number;
  readonly preload: WebSocketPreloadConfig;
}

/**
 * Sentry configuration interface
 */
export interface SentryConfig {
  readonly dsn: string | undefined;
}

/**
 * Chart configuration interface
 */
export interface ChartConfig {
  readonly defaultWidth: number;
  readonly defaultHeight: number;
  readonly defaultCacheTTLSeconds: number;
  readonly defaultTopLimit: number;
}

/**
 * BigInt constants configuration
 */
export interface BigIntConstantsConfig {
  readonly zero: bigint;
}

/**
 * Jitter configuration interface
 */
export interface JitterConfig {
  readonly maxMs: number;
}

/**
 * Legacy cache configuration (deprecated)
 */
export interface LegacyCacheConfig {
  readonly defaultTTL: number;
  readonly enabled: boolean;
}

/**
 * Legacy API rate limit configuration (deprecated)
 */
export interface LegacyApiRateLimitConfig {
  readonly windowMs: number;
  readonly max: number;
}

/**
 * Legacy configuration interface (deprecated)
 */
export interface LegacyConfig {
  readonly cache: LegacyCacheConfig;
  readonly api: {
    readonly rateLimit: LegacyApiRateLimitConfig;
  };
}

/**
 * Complete application configuration interface
 */
export interface ApplicationConfig {
  readonly server: ServerConfig;
  readonly database: DatabaseConfig;
  readonly redis: RedisConfig;
  readonly apis: ApisConfig;
  readonly http: HttpConfig;
  readonly rateLimit: RateLimitConfig;
  readonly features: FeatureFlagsConfig;
  readonly logging: LoggingConfig;
  readonly discord: DiscordConfig;
  readonly websocket: WebSocketConfig;
  readonly sentry: SentryConfig;
  readonly charts: ChartConfig;
  readonly bigIntConstants: BigIntConstantsConfig;
  readonly jitter: JitterConfig;
}

/**
 * Configuration validation constraints
 */
export const ConfigurationConstraints = {
  server: {
    port: { min: 0, max: 65535 },
  },
  redis: {
    cacheTtl: { min: 0, max: 86400 }, // max 24 hours
  },
  http: {
    timeout: { min: 1000, max: 300000 }, // 1s to 5min
    maxRetries: { min: 0, max: 10 },
    initialRetryDelay: { min: 100, max: 60000 }, // 100ms to 1min
    maxRetryDelay: { min: 1000, max: 300000 }, // 1s to 5min
  },
  rateLimit: {
    minDelay: { min: 0, max: 60000 }, // up to 1min
    maxDelay: { min: 0, max: 300000 }, // up to 5min
  },
  websocket: {
    reconnectIntervalMs: { min: 1000, max: 60000 }, // 1s to 1min
    maxReconnectAttempts: { min: 0, max: 100 },
    timeout: { min: 1000, max: 60000 }, // 1s to 1min
    preload: {
      limitPerSystem: { min: 0, max: 1000 },
      sinceHours: { min: 1, max: 744 }, // 1 hour to 31 days
      deliveryBatchSize: { min: 1, max: 100 },
      deliveryIntervalMs: { min: 100, max: 10000 }, // 100ms to 10s
    },
  },
  charts: {
    defaultWidth: { min: 100, max: 4096 },
    defaultHeight: { min: 100, max: 4096 },
    defaultCacheTTLSeconds: { min: 0, max: 86400 }, // max 24 hours
    defaultTopLimit: { min: 1, max: 100 },
  },
  jitter: {
    maxMs: { min: 0, max: 10000 }, // up to 10s
  },
} as const;

/**
 * Type guard to check if a value is within numeric constraints
 */
export function isWithinConstraints(
  value: number,
  constraints: { min: number; max: number }
): boolean {
  return value >= constraints.min && value <= constraints.max;
}

/**
 * Validate configuration at runtime
 */
export function validateConfiguration(config: unknown): config is ApplicationConfig {
  // This would contain runtime validation logic
  // For compile-time validation, we rely on TypeScript's type system
  return true; // Placeholder
}