/**
 * Legacy configuration file - DEPRECATED
 * @deprecated This file is maintained for backward compatibility only.
 * Please use the new validated configuration from './config/validated' instead.
 * 
 * The new configuration provides:
 * - Compile-time type validation with satisfies operator
 * - Runtime validation for environment variables
 * - Type-safe enum values
 * - Constraint validation for numeric values
 */

// Re-export everything from the new validated configuration
export * from './config/validated';
export * from './config/types';

// Legacy config object for backward compatibility
export { config } from './config/validated';