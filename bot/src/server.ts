import express, { RequestHandler } from "express";
import { logger } from "./lib/logger";
import { IngestionService } from "./services/IngestionService";
import {
  startConsumer,
  refreshTrackedCharacters,
} from "./ingestion/redisq-ingest";
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
import { ensureDatabaseTablesExist } from "./application/ingestion/DatabaseCheck";

// Load environment variables
dotenvConfig();

// Constants
const appStartTime = Date.now();
const port =
  process.env.NODE_ENV === "test"
    ? 0
    : process.env.PORT
    ? parseInt(process.env.PORT)
    : 3000;

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

// Initialize services
let ingestionService: IngestionService;
const chartService = new ChartService();
const chartRenderer = new ChartRenderer();

// Configure ingestion
const ingestionConfig = {
  zkillApiUrl: process.env.ZKILLBOARD_API_URL || "https://zkillboard.com/api",
  mapApiUrl: process.env.MAP_API_URL,
  mapApiKey: process.env.MAP_API_KEY,
  redisUrl: process.env.REDIS_URL,
  cacheTtl: parseInt(process.env.CACHE_TTL || "300"),
  batchSize: parseInt(process.env.BATCH_SIZE || "100"),
  backoffMs: parseInt(process.env.BACKOFF_MS || "1000"),
  maxRetries: parseInt(process.env.MAX_RETRIES || "3"),
};

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
    const mapActivityCount = await app.locals.prisma.mapActivity.count();
    const lossCount = await app.locals.prisma.lossFact.count();
    const killCount = await app.locals.prisma.killFact.count();
    const charCount = await app.locals.prisma.character.count();

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
    const characters = await app.locals.prisma.character.findMany({
      include: {
        group: true,
      },
    });

    // Format the response
    const formattedCharacters = characters.map((char: any) => ({
      id: char.eveId,
      name: char.name,
      group: char.group?.name || "No Group",
      groupId: char.group?.groupId,
      lastBackfill: char.lastBackfillAt,
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

// Add an endpoint to trigger a backfill for character kills
interface BackfillKillsParams {
  characterId: string;
}

const backfillKillsHandler: RequestHandler<BackfillKillsParams> = async (
  req,
  res
) => {
  try {
    const characterId = parseInt(req.params.characterId);
    if (isNaN(characterId)) {
      res.status(400).json({ error: "Invalid character ID" });
      return;
    }

    logger.info(
      `Manually triggering kill backfill for character ${characterId}`
    );
    await ingestionService.backfillKills(characterId, 7);

    res.json({
      success: true,
      message: `Backfill triggered for character ${characterId}`,
    });
  } catch (error) {
    logger.error(`Error triggering backfill: ${error}`);
    res.status(500).json({ error: "Failed to trigger backfill" });
  }
};

app.get("/api/diagnostics/backfill-kills/:characterId", backfillKillsHandler);

// Also add an endpoint to refresh tracked characters
const refreshCharactersHandler: RequestHandler = async (_req, res) => {
  try {
    logger.info("Manually refreshing character tracking");
    await refreshTrackedCharacters();

    res.json({ success: true, message: "Character tracking refreshed" });
  } catch (error) {
    logger.error(`Error refreshing character tracking: ${error}`);
    res.status(500).json({ error: "Failed to refresh character tracking" });
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
    const groupId = req.params.groupId;
    if (!groupId) {
      res.status(400).json({ error: "Invalid group ID" });
      return;
    }

    logger.info(
      `Manually triggering kill backfill for all characters in group ${groupId}`
    );

    // Find all characters in the group
    const characters = await app.locals.prisma.character.findMany({
      where: {
        groupId: groupId,
      },
    });

    if (characters.length === 0) {
      res
        .status(404)
        .json({ error: `No characters found for group ${groupId}` });
      return;
    }

    logger.info(`Found ${characters.length} characters in group ${groupId}`);

    // Send response first to avoid timeout
    res.json({
      success: true,
      message: `Backfill started for ${characters.length} characters in group ${groupId}`,
      characters: characters.map((c: any) => ({ id: c.eveId, name: c.name })),
    });

    // Then process asynchronously (after response is sent)
    // No need to await here since we've already responded
    processCharacterBackfills(characters).catch((error) => {
      logger.error(`Error in background processing: ${error}`);
    });
  } catch (error) {
    logger.error(`Error triggering group backfill: ${error}`);
    res.status(500).json({ error: "Failed to trigger group backfill" });
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
      await ingestionService.backfillKills(parseInt(character.eveId), 30);
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
    const initialLossCount = await app.locals.prisma.lossFact.count();
    const initialKillCount = await app.locals.prisma.killFact.count();

    logger.info(
      `Initial counts - Losses: ${initialLossCount}, Kills: ${initialKillCount}`
    );

    // Step 1: Remove all loss records to start fresh
    logger.info("Removing all existing loss records");
    const deletedLosses = await app.locals.prisma.lossFact.deleteMany({});
    logger.info(`Deleted ${deletedLosses.count} loss records`);

    // Step 2: Reset all ingestion checkpoints for losses
    logger.info("Resetting ingestion checkpoints for losses");
    const deletedCheckpoints =
      await app.locals.prisma.ingestionCheckpoint.deleteMany({
        where: {
          streamName: {
            startsWith: "losses:",
          },
        },
      });
    logger.info(`Deleted ${deletedCheckpoints.count} loss checkpoints`);

    // Step 3: Backfill losses for all characters (but limit to 5 in dev mode)
    const characters = await app.locals.prisma.character.findMany();
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
      await ingestionService.backfillLosses(parseInt(character.eveId), 30);
    } catch (error) {
      logger.error(
        `Error backfilling losses for character ${character.name}: ${error}`
      );
    }
  }

  // Get final counts
  const finalLossCount = await app.locals.prisma.lossFact.count();
  const finalKillCount = await app.locals.prisma.killFact.count();

  logger.info(
    `Fix kill/loss balance complete - Final counts - Losses: ${finalLossCount}, Kills: ${finalKillCount}`
  );
}

// Start server
async function startServer() {
  try {
    logger.info("Starting server...");

    // Log key environment variables (masked for security)
    logger.info("Environment variables check:");
    logger.info(`MAP_NAME: ${process.env.MAP_NAME ? "✓ Set" : "❌ Not set"}`);
    logger.info(
      `MAP_API_URL: ${process.env.MAP_API_URL ? "✓ Set" : "❌ Not set"}`
    );
    logger.info(
      `MAP_API_KEY: ${
        process.env.MAP_API_KEY
          ? "✓ Set (starts with: " +
            process.env.MAP_API_KEY?.substring(0, 3) +
            "...)"
          : "❌ Not set"
      }`
    );
    logger.info(
      `ZKILLBOARD_API_URL: ${
        process.env.ZKILLBOARD_API_URL ? "✓ Set" : "❌ Not set"
      }`
    );
    logger.info(`REDIS_URL: ${process.env.REDIS_URL ? "✓ Set" : "❌ Not set"}`);

    // Start ingestion service first
    logger.info("Starting ingestion service...");
    ingestionService = new IngestionService(ingestionConfig);

    // Set prisma instance in app.locals for other routes to access
    app.locals.prisma = ingestionService.prisma;

    // Now check database tables (after ingestion service is initialized)
    logger.info("Ensuring database tables exist...");
    const dbCheckStartTime = Date.now();
    await ensureTablesExist();
    logger.info(
      `Database tables checked/created (${
        (Date.now() - dbCheckStartTime) / 1000
      }s)`
    );

    // Start HTTP server
    const serverStartTime = Date.now();
    app.listen(port, () => {
      const serverReadyTime = Date.now();
      logger.info(
        `Server listening on port ${port} (${
          (serverReadyTime - serverStartTime) / 1000
        }s)`
      );
    });

    // Initialize Discord after DB is ready and HTTP server has started
    logger.info("Starting Discord initialization...");
    initializeDiscord().catch((error) => {
      logger.error("Discord initialization failed:", {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Start RedisQ consumer
    logger.info("Starting RedisQ consumer...");
    startRedisQConsumer(ingestionService);

    // Sync characters from map
    const mapName = process.env.MAP_NAME;
    if (mapName) {
      logger.info(`Syncing characters from map: ${mapName}`);
      await syncCharacters(mapName);
    } else {
      logger.warn("No MAP_NAME configured, skipping character sync");
    }

    // Refresh character tracking
    await refreshCharacters();

    // Backfill characters with zkillboard data
    await backfillCharacters();

    // Ingest map activity data
    if (mapName) {
      logger.info(`Syncing map activity data from map: ${mapName}`);
      try {
        // Use the new refresh method which handles duplicates
        await ingestionService.refreshMapActivityData(mapName, 7); // Get 7 days of activity data instead of 30

        // Check if we got any data
        const mapActivityCount =
          await ingestionService.prisma.mapActivity.count();
        logger.info(
          `Map activity records after ingestion: ${mapActivityCount}`
        );
      } catch (error) {
        logger.error(`Error ingesting map activity: ${error}`);
      }
    } else {
      logger.warn("No MAP_NAME configured, skipping map activity ingestion");
    }

    // Set up scheduled tasks
    logger.info("Setting up scheduled tasks");

    // Schedule map activity sync every hour
    setInterval(async () => {
      try {
        logger.info("Running scheduled map activity refresh...");

        // Use the simpler approach - completely refresh map activity data every hour
        await ingestionService.refreshMapActivityData(process.env.MAP_NAME!, 7);

        // Log current count for monitoring
        const mapActivityCount =
          await ingestionService.prisma.mapActivity.count();
        logger.info(
          `Map activity count after scheduled refresh: ${mapActivityCount}`
        );
      } catch (error) {
        logger.error("Scheduled map activity refresh failed:", error);
      }
    }, 60 * 60 * 1000); // Every hour

    // Handle graceful shutdown
    process.on("SIGTERM", async () => {
      logger.info("Shutting down server...");
      await ingestionService.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error("Failed to start server:", {
      error:
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
              stack: error.stack,
            }
          : error,
    });

    // Don't exit the process when running tests
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
  }
}

// Initialize Discord functionality
async function initializeDiscord() {
  try {
    const discordStartTime = Date.now();
    logger.info(
      `Discord initialization starting... (${
        (discordStartTime - appStartTime) / 1000
      }s after app start)`
    );

    // Validate Discord token
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error("DISCORD_BOT_TOKEN environment variable is not set");
    }
    logger.debug("Found Discord token:", token.substring(0, 10) + "...");

    // Login to Discord
    logger.info("Logging in to Discord...");
    await discordClient.login(token);
    const loginTime = Date.now();
    logger.info(
      `Discord login successful - Client ready state: ${
        discordClient.isReady() ? "Ready" : "Not Ready"
      } (${(loginTime - discordStartTime) / 1000}s)`
    );

    // Register commands
    logger.info("Registering Discord commands...");
    await discordClient.registerCommands(commands);
    const registerTime = Date.now();
    logger.info(
      `Discord commands registered successfully (${
        (registerTime - loginTime) / 1000
      }s)`
    );

    // Add specific Discord readiness log
    setTimeout(() => {
      const readyCheckTime = Date.now();
      logger.info(
        `Discord client status check after 5 seconds: (Total time since app start: ${
          (readyCheckTime - appStartTime) / 1000
        }s)`,
        {
          ready: discordClient.isReady() ? "Yes" : "No",
          guilds: discordClient.getGuildsCount(),
        }
      );
    }, 5000);
  } catch (error) {
    logger.error("Discord initialization failed:", error);
    throw error;
  }
}

// Run backfill process
async function backfillCharacters() {
  try {
    // Re-enable backfill now that we've fixed the database structure
    logger.info("Backfilling kills and losses for all characters...");
    const characters = await ingestionService.prisma.character.findMany();
    const totalCharacters = characters.length;
    logger.info(`Found ${totalCharacters} characters to backfill`);

    // Check if we have any loss data before starting
    const initialLossCount = await ingestionService.prisma.lossFact.count();
    const initialKillCount = await (
      ingestionService.prisma as any
    ).killFact.count();
    logger.info(
      `Initial counts - Losses: ${initialLossCount}, Kills: ${initialKillCount}`
    );

    // Keep track of errors for reporting
    const backfillErrors = [];

    // Process all characters
    logger.info(
      `Will process all ${characters.length} characters for backfill`
    );

    for (let i = 0; i < characters.length; i++) {
      const character = characters[i];
      logger.info(
        `Backfilling kills for character: ${character.name} (${
          character.eveId
        }) - ${i + 1}/${characters.length} (${Math.round(
          ((i + 1) / characters.length) * 100
        )}%)`
      );

      try {
        // Backfill kills
        await ingestionService.backfillKills(parseInt(character.eveId), 30); // 30 days max age
      } catch (killsError) {
        const errorInfo = {
          character: character.name,
          characterId: character.eveId,
          errorType: "kills_backfill",
          errorMessage:
            killsError instanceof Error
              ? killsError.message
              : String(killsError),
          errorStack:
            killsError instanceof Error ? killsError.stack : undefined,
        };
        backfillErrors.push(errorInfo);
        logger.error(
          errorInfo,
          `Error backfilling kills for character ${character.name}`
        );
      }

      try {
        // Now also backfill losses using our new method
        logger.info(
          `Backfilling losses for character: ${character.name} (${character.eveId})`
        );
        await ingestionService.backfillLosses(parseInt(character.eveId), 30); // 30 days max age
      } catch (lossesError) {
        const errorInfo = {
          character: character.name,
          characterId: character.eveId,
          errorType: "losses_backfill",
          errorMessage:
            lossesError instanceof Error
              ? lossesError.message
              : String(lossesError),
          errorStack:
            lossesError instanceof Error ? lossesError.stack : undefined,
        };
        backfillErrors.push(errorInfo);
        logger.error(
          errorInfo,
          `Error backfilling losses for character ${character.name}`
        );
      }
    }

    // Check our progress
    const finalLossCount = await ingestionService.prisma.lossFact.count();
    const finalKillCount = await (
      ingestionService.prisma as any
    ).killFact.count();

    logger.info(
      `Final counts - Losses: ${finalLossCount} (+${
        finalLossCount - initialLossCount
      }), Kills: ${finalKillCount} (+${finalKillCount - initialKillCount})`
    );

    if (backfillErrors.length > 0) {
      logger.warn(
        `Completed character backfill with ${backfillErrors.length} errors. See logs for details.`
      );
    } else {
      logger.info(
        "Character backfill process completed successfully with no errors"
      );
    }
  } catch (error) {
    logger.error(
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
      "Character backfill process failed"
    );
    throw error;
  }
}

// Sync characters from map
async function syncCharacters(mapName: string) {
  try {
    logger.info(`Syncing user characters from map ${mapName}`);
    await ingestionService.syncUserCharacters(mapName);

    // Check how many characters we got
    const characterCount = await ingestionService.prisma.character.count();
    logger.info(`Character count after sync: ${characterCount}`);

    if (characterCount === 0) {
      logger.warn(
        `No characters found after sync. This will cause no data to be collected.`
      );
    }
  } catch (error) {
    logger.error(`Error syncing characters: ${error}`);
  }
}

// Refresh character tracking for RedisQ
async function refreshCharacters() {
  try {
    // This will refresh the list of characters we're tracking in RedisQ
    logger.info("Refreshing tracked characters...");
    await refreshTrackedCharacters();
    logger.info("Character tracking refreshed");
  } catch (error) {
    logger.error(`Error refreshing character tracking: ${error}`);
  }
}

// Start RedisQ consumer for killmail ingestion
function startRedisQConsumer(ingestionService: IngestionService) {
  try {
    logger.info("Starting RedisQ consumer...");
    startConsumer(ingestionService);
    logger.info("RedisQ consumer started successfully");
  } catch (error) {
    logger.error(`Error starting RedisQ consumer: ${error}`);
  }
}

// Ensure all necessary database tables exist
async function ensureTablesExist() {
  try {
    logger.info("Checking database schema...");

    // Use the centralized database check utility
    await ensureDatabaseTablesExist(ingestionService.prisma);
  } catch (error) {
    logger.error(`Error checking database schema: ${error}`);
  }
}

// Start the server
startServer();

// Export for testing
export default app;
