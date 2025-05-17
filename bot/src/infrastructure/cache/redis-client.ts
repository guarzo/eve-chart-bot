import Redis from "ioredis";
import { logger } from "../../lib/logger";

// Get Redis connection string from environment or use a default
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Create a Redis client singleton
const redis = new Redis(redisUrl);

// Log connection state
redis.on("connect", () => {
  logger.info(`Redis client connected to ${redisUrl}`);
});

redis.on("error", (err) => {
  logger.error(`Redis client error: ${err.message}`);
});

export default redis;
