import { config } from "dotenv";
import { Client, GatewayIntentBits, Events } from "discord.js";
import { logger } from "../../../lib/logger";

// Load environment variables
config();

async function resetCommands() {
  try {
    logger.info("Starting command removal...");

    // Check environment variables
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error("DISCORD_BOT_TOKEN environment variable is not set");
    }

    // Initialize Discord client
    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    // Wait for client to be ready
    await new Promise<void>((resolve) => {
      client.once(Events.ClientReady, () => resolve());
      client.login(token);
    });

    logger.info(`Bot logged in as ${client.user?.tag}`);

    // Get the application
    const application = client.application;
    if (!application) {
      throw new Error("Application not available");
    }

    // Remove global commands
    logger.info("Removing global commands...");
    await application.commands.set([]);
    logger.info("Successfully removed global commands");

    // Remove guild commands from all guilds
    logger.info("Removing guild commands...");
    for (const guild of client.guilds.cache.values()) {
      try {
        await guild.commands.set([]);
        logger.info(`Removed commands from guild: ${guild.name}`);
      } catch (error) {
        logger.error(`Failed to remove commands from guild ${guild.name}:`, {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    // Verify command removal
    const globalCommands = await application.commands.fetch();
    logger.info(
      "Remaining global commands:",
      globalCommands.map((cmd) => cmd.name)
    );

    // Clean up
    client.destroy();
    logger.info("Command removal complete");
  } catch (error) {
    logger.error("Failed to remove commands:", {
      error:
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
              stack: error.stack,
            }
          : error,
    });
    process.exit(1);
  }
}

// Run the reset
resetCommands();
