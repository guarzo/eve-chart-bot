import { config } from "dotenv";
import { IngestionService } from "../services/IngestionService";
import { RedisQConsumer } from "./redisq-ingest";
import { logger } from "../lib/logger";
import { PrismaClient } from "@prisma/client";

config();

const prisma = new PrismaClient();

async function main() {
  const ingestionService = new IngestionService({
    zkillApiUrl: process.env.ZKILLBOARD_API_URL!,
    mapApiUrl: process.env.MAP_API_URL,
    mapApiKey: process.env.MAP_API_KEY,
    esiApiUrl: process.env.ESI_API_URL,
    redisUrl: process.env.REDIS_URL,
    cacheTtl: parseInt(process.env.CACHE_TTL || "300"),
    batchSize: parseInt(process.env.BATCH_SIZE || "100"),
    backoffMs: parseInt(process.env.BACKOFF_MS || "1000"),
    maxRetries: parseInt(process.env.MAX_RETRIES || "3"),
  });

  const redisQConsumer = new RedisQConsumer(process.env.REDIS_URL!);

  try {
    // Start RedisQ consumer
    await redisQConsumer.start();

    logger.info("All ingestion services started successfully");

    // Handle graceful shutdown
    process.on("SIGTERM", async () => {
      logger.info("Shutting down ingestion services");
      await redisQConsumer.stop();
      await ingestionService.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error({ error }, "Failed to start ingestion services");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

export async function startIngestion() {
  try {
    logger.info("Starting ingestion service...");
    await main();
    logger.info("Ingestion service started successfully");
  } catch (error) {
    logger.error("Failed to start ingestion service:", error);
    throw error;
  }
}

export default startIngestion;
