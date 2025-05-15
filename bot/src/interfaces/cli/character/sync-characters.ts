import { config } from "dotenv";
import { join } from "path";
import { IngestionService } from "../../../services/IngestionService";
import { logger } from "../../../lib/logger";

// Load environment variables from bot directory
config({ path: join(__dirname, "../../.env") });

async function syncCharacters() {
  const ingestionService = new IngestionService({
    zkillApiUrl: process.env.ZKILLBOARD_API_URL!,
    mapApiUrl: process.env.MAP_API_URL!,
    mapApiKey: process.env.MAP_API_KEY!,
    esiApiUrl: process.env.ESI_API_URL!,
    redisUrl: process.env.REDIS_URL!,
    cacheTtl: parseInt(process.env.CACHE_TTL || "300"),
    batchSize: parseInt(process.env.BATCH_SIZE || "100"),
    backoffMs: parseInt(process.env.BACKOFF_MS || "1000"),
    maxRetries: parseInt(process.env.MAX_RETRIES || "3"),
  });

  try {
    logger.info("Starting character synchronization...");
    logger.info(`Using MAP_NAME: ${process.env.MAP_NAME}`);

    // Sync characters using MAP_NAME from environment
    await ingestionService.syncUserCharacters(process.env.MAP_NAME!);

    // Count total characters after sync
    const totalCharacters = await ingestionService.prisma.character.count();
    logger.info(`Total characters in database: ${totalCharacters}`);

    // Count characters by group
    const charactersByGroup = await ingestionService.prisma.character.groupBy({
      by: ["characterGroupId"],
      _count: true,
    });
    logger.info("Characters by group:", charactersByGroup);

    logger.info("Successfully synced characters from Map API");
  } catch (error) {
    logger.error("Failed to sync characters:", error);
  } finally {
    await ingestionService.close();
  }
}

syncCharacters();
