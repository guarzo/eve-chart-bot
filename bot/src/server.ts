import "reflect-metadata";
import express, { RequestHandler } from "express";
import { logger } from "./lib/logger";
import { RedisQService } from "./services/ingestion/RedisQService";
import { config as dotenvConfig } from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import rateLimit from "express-rate-limit";
import { DiscordClient } from "./lib/discord/client";
import { commands } from "./lib/discord/commands";
import { ChartService } from "./services/ChartService";
import { ChartRenderer } from "./services/ChartRenderer";
import { ChartOptions } from "./types/chart";
import { z } from "zod";
import { initSentry } from "./lib/sentry";
import { KillmailIngestionService } from "./services/ingestion/KillmailIngestionService";
import { MapActivityService } from "./services/ingestion/MapActivityService";
import { CharacterSyncService } from "./services/ingestion/CharacterSyncService";
import { CharacterRepository } from "./infrastructure/repositories/CharacterRepository";
import { KillRepository } from "./infrastructure/repositories/KillRepository";
import { MapActivityRepository } from "./infrastructure/repositories/MapActivityRepository";
import { NODE_ENV, INTERNAL_CONFIG } from "./config";

// Load environment variables
dotenvConfig();

// Initialize Sentry
initSentry();

// Constants
const appStartTime = Date.now();
const port = NODE_ENV === "test" ? 0 : 3000; // Use random port for tests

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  })
);

// Initialize services using internal configuration
const killmailService = new KillmailIngestionService();
const mapService = new MapActivityService();
const characterService = new CharacterSyncService();
let redisQService: RedisQService | null = null;
const chartService = new ChartService();
const chartRenderer = new ChartRenderer();

// Initialize repositories
const characterRepository = new CharacterRepository();
const killRepository = new KillRepository();
const mapActivityRepository = new MapActivityRepository();

// Validation schemas
const chartConfigSchema = z.object({
  type: z.enum(["kills", "map_activity"]),
  characterIds: z.array(z.bigint()),
  period: z.enum(["24h", "7d", "30d", "90d"]),
  groupBy: z.enum(["hour", "day", "week"]).optional(),
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Get available chart types
app.get("/v1/charts/types", (_req, res) => {
  res.json({
    types: [
      {
        id: "kills",
        name: "Kill Chart",
        description: "Generate a chart showing kill activity",
        periods: ["24h", "7d", "30d", "90d"],
        groupBy: ["hour", "day", "week"],
      },
      {
        id: "map_activity",
        name: "Map Activity Chart",
        description: "Generate a chart showing map activity",
        periods: ["24h", "7d", "30d", "90d"],
        groupBy: ["hour", "day", "week"],
      },
    ],
  });
});

app.post("/v1/charts/generate", async (req, res) => {
  try {
    const config = chartConfigSchema.parse(req.body);

    // Generate chart data
    const chartData = await chartService.generateChart(config);

    // Ensure ChartConfig has required 'data' property
    const chartConfigWithData = {
      ...config,
      data: chartData,
    };

    // Create chart options
    const options: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${
            config.type === "kills" ? "Kills" : "Map Activity"
          } - 7 Days Rolling Data`,
        },
        legend: {
          display: true,
          position: "top",
        },
      },
    };

    // Render chart to buffer
    const buffer = await chartRenderer.renderToBuffer(
      chartConfigWithData.data,
      options
    );

    res.setHeader("Content-Type", "image/png");
    res.send(buffer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
    } else {
      console.error("Error generating chart:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Add debug endpoint for DB counts
app.get("/debug/counts", async (_req, res) => {
  try {
    const mapActivityCount = await mapActivityRepository.count();
    const lossCount = await killRepository.countLosses();
    const killCount = await killRepository.countKills();
    const charCount = await characterRepository.count();

    res.status(200).json({
      status: "ok",
      counts: {
        mapActivity: mapActivityCount,
        losses: lossCount,
        kills: killCount,
        characters: charCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Initialize Discord bot
const discordClient = new DiscordClient();

// Add diagnostic routes
app.get("/api/diagnostics/tracked-characters", async (_req, res) => {
  try {
    const characters = await characterRepository.getAllCharacters();
    const formattedCharacters = characters.map((char) => ({
      eveId: char.eveId,
      name: char.name,
      corporationId: char.corporationId,
      allianceId: char.allianceId,
      isMain: char.isMain,
      characterGroupId: char.characterGroupId,
    }));

    res.json({
      total: characters.length,
      characters: formattedCharacters,
    });
  } catch (error) {
    logger.error(`Error getting tracked characters: ${error}`);
    res.status(500).json({ error: "Failed to get tracked characters" });
  }
});

// Backfill endpoint
app.post("/api/backfill/character/:characterId", async (req, res) => {
  try {
    const characterId = BigInt(req.params.characterId);
    const maxAgeDays = parseInt(req.query.maxAgeDays as string) || 30;

    logger.info(
      `Starting backfill for character ${characterId} (max age: ${maxAgeDays} days)`
    );

    await killmailService.backfillKills(characterId, maxAgeDays);

    res.json({
      success: true,
      message: `Backfill completed for character ${characterId}`,
    });
  } catch (error: any) {
    logger.error(`Backfill error: ${error.message}`);
    res.status(500).json({
      error: "Backfill failed",
      message: error.message,
    });
  }
});

// Backfill all characters endpoint
app.post("/api/backfill/all", async (req, res) => {
  try {
    const maxAgeDays = parseInt(req.query.maxAgeDays as string) || 30;

    logger.info(
      `Starting backfill for all characters (max age: ${maxAgeDays} days)`
    );

    const characters = await characterRepository.getAllCharacters();
    let successCount = 0;
    let errorCount = 0;

    for (const character of characters) {
      try {
        await killmailService.backfillKills(
          BigInt(character.eveId),
          maxAgeDays
        );
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(`Error backfilling character ${character.eveId}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Backfill completed for ${characters.length} characters`,
      results: {
        total: characters.length,
        successful: successCount,
        errors: errorCount,
      },
    });
  } catch (error: any) {
    logger.error(`Backfill all error: ${error.message}`);
    res.status(500).json({
      error: "Backfill failed",
      message: error.message,
    });
  }
});

// Also add an endpoint to refresh tracked characters
const refreshCharactersHandler: RequestHandler = async (_req, res) => {
  try {
    if (!redisQService) {
      throw new Error("RedisQ service not initialized");
    }
    await refreshCharacters();
    res.json({ status: "ok", message: "Characters refreshed" });
  } catch (error) {
    logger.error(`Error refreshing characters: ${error}`);
    res.status(500).json({ error: "Failed to refresh characters" });
  }
};

app.get(
  "/api/diagnostics/refresh-character-tracking",
  refreshCharactersHandler
);

// Add an endpoint to backfill all characters in a specific group
interface BackfillGroupParams {
  groupId: string;
}

const backfillGroupHandler: RequestHandler<BackfillGroupParams> = async (
  req,
  res
) => {
  try {
    const { groupId } = req.params;

    // Find all characters in the group
    const characters = await characterRepository.getCharactersByGroup(groupId);

    if (characters.length === 0) {
      res.status(404).json({
        success: false,
        message: `No characters found in group ${groupId}`,
      });
      return;
    }

    // Start backfill for each character
    processCharacterBackfills(characters).catch((error) => {
      logger.error(`Error backfilling group ${groupId}: ${error}`);
    });

    res.json({
      success: true,
      message: `Backfill started for ${characters.length} characters in group ${groupId}`,
      characters: characters.map((c) => ({ id: c.eveId, name: c.name })),
    });
  } catch (error) {
    logger.error(`Error backfilling group: ${error}`);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

app.get("/api/diagnostics/backfill-group/:groupId", backfillGroupHandler);

// Helper function to process character backfills asynchronously
async function processCharacterBackfills(characters: any[]): Promise<void> {
  for (const character of characters) {
    try {
      logger.info(
        `Backfilling kills for character ${character.name} (${character.eveId})`
      );
      await backfillKills(BigInt(character.eveId));
    } catch (error) {
      logger.error(
        `Error backfilling kills for character ${character.name}: ${error}`
      );
    }
  }
  logger.info("Character backfill processing completed");
}

// Add an endpoint to clean up and rebalance kill/loss data
const fixKillLossBalanceHandler: RequestHandler = async (_req, res) => {
  try {
    logger.info("Starting kill/loss data cleanup and rebalance");

    // First, get current counts
    const initialLossCount = await killRepository.countLosses();
    const initialKillCount = await killRepository.countKills();

    logger.info(
      `Initial counts - Losses: ${initialLossCount}, Kills: ${initialKillCount}`
    );

    // Step 1: Remove all loss records to start fresh
    logger.info("Removing all existing loss records");
    const deletedLosses = await killRepository.deleteAllLosses();
    logger.info(`Deleted ${deletedLosses.count} loss records`);

    // Step 2: Reset all ingestion checkpoints for losses
    logger.info("Resetting ingestion checkpoints for losses");
    const deletedCheckpoints = await killRepository.deleteAllLossCheckpoints();
    logger.info(`Deleted ${deletedCheckpoints.count} loss checkpoints`);

    // Step 3: Backfill losses for all characters (but limit to 5 in dev mode)
    const characters = await characterRepository.getAllCharacters();
    const totalCharacters = characters.length;
    logger.info(`Found ${totalCharacters} characters to backfill losses for`);

    // Process all characters
    logger.info(
      `Will process all ${characters.length} characters for loss backfill`
    );

    // Begin the response to avoid timeout
    res.json({
      success: true,
      message: "Kill/loss data cleanup and rebalance started",
      initialCounts: {
        losses: initialLossCount,
        kills: initialKillCount,
      },
      charactersToProcess: totalCharacters,
    });

    // Continue processing after sending response
    processLossBackfill(characters).catch((error) => {
      logger.error(`Error in loss backfill processing: ${error}`);
    });
  } catch (error) {
    logger.error(`Error fixing kill/loss balance: ${error}`);
    res.status(500).json({ error: "Failed to fix kill/loss balance" });
  }
};

app.get("/api/diagnostics/fix-kill-loss-balance", fixKillLossBalanceHandler);

// Helper function to process loss backfill asynchronously
async function processLossBackfill(characters: any[]): Promise<void> {
  for (let i = 0; i < characters.length; i++) {
    const character = characters[i];
    try {
      logger.info(
        `Backfilling losses for character: ${character.name} (${
          character.eveId
        }) - ${i + 1}/${characters.length}`
      );
      await backfillLosses(BigInt(character.eveId));
    } catch (error) {
      logger.error(
        `Error backfilling losses for character ${character.name}: ${error}`
      );
    }
  }

  // Get final counts
  const finalLossCount = await killRepository.countLosses();
  const finalKillCount = await killRepository.countKills();

  logger.info(
    `Fix kill/loss balance complete - Final counts - Losses: ${finalLossCount}, Kills: ${finalKillCount}`
  );
}

// Helper functions
async function backfillKills(characterId: bigint) {
  await killmailService.backfillKills(characterId);
}

async function backfillLosses(characterId: bigint) {
  await killmailService.backfillLosses(characterId);
}

// Cleanup function
async function cleanup() {
  try {
    if (redisQService) {
      await redisQService.stop();
    }
    // Close map service
    if (mapService) {
      await mapService.close();
    }
    // Close character service
    if (characterService) {
      await characterService.close();
    }
  } catch (error) {
    logger.error("Error during cleanup:", error);
  }
}

export async function startServer() {
  try {
    // Initialize RedisQ service
    redisQService = new RedisQService(INTERNAL_CONFIG.REDIS_URL);
    await redisQService.start();

    // Initialize Discord if token is available
    const discordToken = process.env.DISCORD_BOT_TOKEN;
    if (discordToken) {
      try {
        await discordClient.login(discordToken);
        await discordClient.registerCommands(commands);
        logger.info("Discord bot initialized successfully");
      } catch (error) {
        logger.error("Failed to initialize Discord bot:", error);
      }
    } else {
      logger.warn("No Discord token provided, bot will not be available");
    }

    // Start the server
    const server = app.listen(port, () => {
      const uptime = Date.now() - appStartTime;
      logger.info(
        `Server started on port ${port} (took ${uptime}ms to initialize)`
      );
    });

    // Handle graceful shutdown
    process.on("SIGTERM", async () => {
      logger.info("Received SIGTERM signal, shutting down gracefully");
      await cleanup();
      server.close(() => {
        logger.info("Server closed");
        process.exit(0);
      });
    });

    return server;
  } catch (error) {
    logger.error("Failed to start server:", error);
    throw error;
  }
}

// Refresh character tracking for RedisQ
async function refreshCharacters() {
  try {
    if (!redisQService) {
      throw new Error("RedisQ service not initialized");
    }
    await redisQService.refreshTrackedCharacters();
    logger.info("Characters refreshed successfully");
  } catch (error) {
    logger.error(`Error refreshing characters: ${error}`);
    throw error;
  }
}

// Start the server
startServer();

// Export for testing
export default app;
