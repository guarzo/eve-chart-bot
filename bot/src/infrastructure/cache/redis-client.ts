import { Redis } from 'ioredis';
import { REDIS_URL } from '../../config';
import { logger } from '../../lib/logger';

const redisUrl = REDIS_URL;

// Create a Redis client singleton
export const redis = new Redis(redisUrl);

// Log connection state
redis.on('connect', () => {
  logger.info(`Redis client connected to ${redisUrl}`);
});

redis.on('error', err => {
  logger.error(`Redis client error: ${err.message}`);
});
