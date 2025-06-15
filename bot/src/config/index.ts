/**
 * Configuration module with compile-time validation
 * 
 * This module provides type-safe configuration with the following features:
 * - Compile-time validation using TypeScript's satisfies operator
 * - Runtime validation for environment variables
 * - Type-safe enum values for string configurations
 * - Constraint validation for numeric values
 * - Backward compatibility with legacy configuration
 */

// Re-export everything from validated configuration
export * from './validated';

// Re-export types for external use
export type {
  ApplicationConfig,
  ServerConfig,
  DatabaseConfig,
  RedisConfig,
  ApisConfig,
  HttpConfig,
  RateLimitConfig,
  FeatureFlagsConfig,
  LoggingConfig,
  DiscordConfig,
  WebSocketConfig,
  SentryConfig,
  ChartConfig,
  BigIntConstantsConfig,
  JitterConfig,
  ConfigurationConstraints,
} from './types';

// Re-export validation utilities
export { isWithinConstraints, validateConfiguration } from './types';