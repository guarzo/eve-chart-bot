/**
 * Configuration validation examples
 * This file demonstrates compile-time validation using satisfies operator
 */

import { ApplicationConfig, LegacyConfig } from './types';
import { Environment, LogLevel } from '../shared/enums';

// ✅ Valid configuration - compiles successfully
const validConfig = {
  server: {
    port: 3000,
    nodeEnv: Environment.PRODUCTION,
  },
  database: {
    url: 'postgresql://localhost:5432/evechart',
  },
  redis: {
    url: 'redis://localhost:6379',
    cacheTtl: 300,
  },
  apis: {
    wandererKills: {
      url: 'ws://localhost:4004',
    },
    map: {
      url: 'https://api.eve-map.net',
      key: 'secret-key',
      name: 'MyMap',
    },
    esi: {
      baseUrl: 'https://esi.evetech.net/latest',
    },
    zkillboard: {
      baseUrl: 'https://zkillboard.com/api',
    },
  },
  http: {
    timeout: 30000,
    maxRetries: 3,
    initialRetryDelay: 1000,
    maxRetryDelay: 45000,
  },
  rateLimit: {
    minDelay: 1000,
    maxDelay: 10000,
  },
  features: {
    newChartRendering: true,
    redisCache: true,
    newIngestionService: false,
    awoxDetection: false,
  },
  logging: {
    level: LogLevel.INFO,
  },
  discord: {
    token: 'discord-bot-token',
  },
  websocket: {
    url: 'ws://localhost:4004',
    reconnectIntervalMs: 5000,
    maxReconnectAttempts: 10,
    timeout: 10000,
    preload: {
      enabled: true,
      limitPerSystem: 100,
      sinceHours: 168,
      deliveryBatchSize: 10,
      deliveryIntervalMs: 1000,
    },
  },
  sentry: {
    dsn: 'https://example@sentry.io/123456',
  },
  charts: {
    defaultWidth: 800,
    defaultHeight: 600,
    defaultCacheTTLSeconds: 3600,
    defaultTopLimit: 10,
  },
  bigIntConstants: {
    zero: 0n,
  },
  jitter: {
    maxMs: 1000,
  },
} as const satisfies ApplicationConfig;

// ❌ Invalid configurations - would fail at compile time
// Uncomment these to see TypeScript errors

// Invalid port (string instead of number)
// const invalidConfig1 = {
//   ...validConfig,
//   server: {
//     ...validConfig.server,
//     port: '3000', // Error: Type 'string' is not assignable to type 'number'
//   },
// } as const satisfies ApplicationConfig;

// Invalid environment (not in enum)
// const invalidConfig2 = {
//   ...validConfig,
//   server: {
//     ...validConfig.server,
//     nodeEnv: 'invalid-env', // Error: Type '"invalid-env"' is not assignable
//   },
// } as const satisfies ApplicationConfig;

// Missing required property
// const invalidConfig3 = {
//   ...validConfig,
//   redis: {
//     url: 'redis://localhost:6379',
//     // cacheTtl missing - Error: Property 'cacheTtl' is missing
//   },
// } as const satisfies ApplicationConfig;

// Invalid log level
// const invalidConfig4 = {
//   ...validConfig,
//   logging: {
//     level: 'verbose', // Error: Type '"verbose"' is not assignable
//   },
// } as const satisfies ApplicationConfig;

// Extra property not allowed
// const invalidConfig5 = {
//   ...validConfig,
//   extraProperty: 'not-allowed', // Error: Object literal may only specify known properties
// } as const satisfies ApplicationConfig;

/**
 * Example of runtime validation for environment variables
 */
export function validateEnvironmentConfig(): void {
  const requiredEnvVars = [
    'DATABASE_URL',
    'DISCORD_BOT_TOKEN',
    'MAP_API_KEY',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate numeric constraints
  const port = parseInt(process.env.PORT || '3000');
  if (port < 0 || port > 65535) {
    console.error(`Invalid port number: ${port}. Must be between 0 and 65535.`);
  }

  const cacheTimeout = parseInt(process.env.HTTP_TIMEOUT || '30000');
  if (cacheTimeout < 1000 || cacheTimeout > 300000) {
    console.warn(`HTTP timeout ${cacheTimeout}ms is outside recommended range (1s-5min)`);
  }
}

/**
 * Example of using configuration with full type safety
 */
export function useConfiguration(config: ApplicationConfig): void {
  // TypeScript knows all the exact types
  const port: number = config.server.port;
  const env: `${Environment}` = config.server.nodeEnv;
  const logLevel: `${LogLevel}` = config.logging.level;
  
  // TypeScript prevents invalid usage
  // config.server.port = 'invalid'; // Error: Cannot assign to 'port' because it is a read-only property
  // config.logging.level = 'invalid'; // Error: Type '"invalid"' is not assignable
  
  console.log(`Server running on port ${port} in ${env} mode with log level ${logLevel}`);
}