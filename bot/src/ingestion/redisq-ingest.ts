import { RedisQService } from "../services/ingestion/RedisQService";
import { logger } from "../lib/logger";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error("REDIS_URL environment variable is required");
}

async function main() {
  const redisQService = new RedisQService(
    REDIS_URL as string,
    parseInt(process.env.MAX_RETRIES || "3"),
    parseInt(process.env.RETRY_DELAY || "5000"),
    parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || "5"),
    parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || "30000")
  );

  try {
    logger.info("Starting RedisQ consumer...");
    await redisQService.start();

    // Log metrics every minute
    setInterval(() => {
      const metrics = redisQService.getMetrics();
      logger.info("RedisQ metrics:", metrics);
    }, 60000);

    // Keep the process running
    process.on("SIGINT", async () => {
      logger.info("Shutting down RedisQ consumer...");
      await redisQService.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      logger.info("Received SIGTERM, shutting down RedisQ consumer...");
      await redisQService.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error("Error in RedisQ consumer:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error("Unhandled error in RedisQ consumer:", error);
  process.exit(1);
});
