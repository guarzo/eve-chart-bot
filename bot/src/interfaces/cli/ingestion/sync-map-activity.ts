import { config } from "dotenv";
import { join } from "path";
import { IngestionService } from "../../../services/IngestionService";
import { logger } from "../../../lib/logger";

// Load environment variables from bot directory
config({ path: join(__dirname, "../../.env") });

async function syncMapActivity() {
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
    logger.info("Starting map activity synchronization...");
    logger.info(`Using MAP_NAME: ${process.env.MAP_NAME}`);

    // Sync map activity for the last 7 days
    await ingestionService.ingestMapActivity(process.env.MAP_NAME!, 7);

    // Count total map activities after sync
    const totalActivities = await ingestionService.prisma.mapActivity.count();
    logger.info(`Total map activities in database: ${totalActivities}`);

    // Get recent activities
    const recentActivities = await ingestionService.prisma.mapActivity.findMany(
      {
        take: 5,
        orderBy: { timestamp: "desc" },
      }
    );

    logger.info("Recent map activities:");
    for (const activity of recentActivities) {
      logger.info(
        `Character ID: ${activity.characterId}, Time: ${activity.timestamp}, Signatures: ${activity.signatures}, Connections: ${activity.connections}, Passages: ${activity.passages}`
      );
    }

    logger.info("Successfully synced map activity from Map API");
  } catch (error) {
    logger.error("Failed to sync map activity:", error);
  } finally {
    await ingestionService.close();
  }
}

syncMapActivity();
