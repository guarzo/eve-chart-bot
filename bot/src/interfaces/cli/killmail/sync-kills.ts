import { config } from "dotenv";
import { join } from "path";
import { IngestionService } from "../../../services/IngestionService";
import { logger } from "../../../lib/logger";

// Load environment variables from bot directory
config({ path: join(__dirname, "../../.env") });

async function syncKills() {
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
    logger.info("Starting kill data synchronization...");

    // Get all characters from the database
    const characters = await ingestionService.prisma.character.findMany();
    logger.info(`Found ${characters.length} characters to process`);

    let totalKills = 0;
    let processedCharacters = 0;

    // Process each character
    for (const character of characters) {
      try {
        logger.info(
          `Processing kills for character: ${character.name} (${character.eveId})`
        );
        await ingestionService.backfillKills(parseInt(character.eveId));

        // Count kills for this character
        const characterKills = await ingestionService.prisma.killFact.count({
          where: { character_id: BigInt(character.eveId) },
        });

        totalKills += characterKills;
        processedCharacters++;

        logger.info(`Processed ${characterKills} kills for ${character.name}`);
      } catch (error) {
        logger.error(
          { error, characterId: character.eveId },
          `Failed to process kills for character: ${character.name}`
        );
      }
    }

    logger.info(
      `Kill sync complete. Processed ${processedCharacters} characters with ${totalKills} total kills`
    );

    // Get recent kills
    const recentKills = await ingestionService.prisma.killFact.findMany({
      take: 5,
      orderBy: { kill_time: "desc" },
    });

    logger.info("Recent kills:");
    for (const kill of recentKills) {
      logger.info(
        `Kill ID: ${kill.killmail_id}, Character ID: ${kill.character_id}, Time: ${kill.kill_time}, Value: ${kill.total_value}`
      );
    }
  } catch (error) {
    logger.error("Failed to sync kills:", error);
  } finally {
    await ingestionService.close();
  }
}

syncKills();
