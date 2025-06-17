const pino = require('pino');
import { ValidatedConfiguration } from '../config/validated';

// Define log levels
const LOG_LEVELS = {
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
} as const;

// Get log level from configuration
const logLevel = ValidatedConfiguration.logging.level;

// Validate log level
if (!Object.keys(LOG_LEVELS).includes(logLevel)) {
  console.warn(`Invalid LOG_LEVEL "${logLevel}", defaulting to "info"`);
}

// Create base logger configuration
const baseConfig = {
  level: logLevel,
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
};

// Development configuration with pretty printing
const devConfig = {
  ...baseConfig,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      messageFormat: false, // Show full message with data
      singleLine: false, // Allow multi-line for objects
    },
  },
};

// Production configuration (JSON format)
const prodConfig = {
  ...baseConfig,
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
};

// Create logger instance based on environment
const logger = pino(process.env.NODE_ENV === 'production' ? prodConfig : devConfig);

// Create child logger with context
export function createLogger(context: string) {
  return logger.child({ context });
}

// Export log levels for type safety
export const logLevels = LOG_LEVELS;
export { logger };
