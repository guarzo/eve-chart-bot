import { config } from "dotenv";
import {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { logger } from "../../../lib/logger";

// Load environment variables
config();

async function registerTestCommands() {
  try {
    logger.info("Starting test command registration...");

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

    // Create test commands with different names
    const testCommands = [
      new SlashCommandBuilder()
        .setName("testkills")
        .setDescription("Test kill chart command")
        .setDefaultMemberPermissions(
          PermissionFlagsBits.SendMessages | PermissionFlagsBits.ViewChannel
        ),

      new SlashCommandBuilder()
        .setName("testmap")
        .setDescription("Test map chart command")
        .setDefaultMemberPermissions(
          PermissionFlagsBits.SendMessages | PermissionFlagsBits.ViewChannel
        ),
    ];

    // Register test commands in each guild
    logger.info("Registering test commands in guilds...");
    for (const guild of client.guilds.cache.values()) {
      try {
        logger.info(`Registering commands in guild: ${guild.name}`);
        await guild.commands.set(testCommands);
        logger.info(`Successfully registered commands in guild: ${guild.name}`);
      } catch (error) {
        logger.error(`Failed to register commands in guild ${guild.name}:`, {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    // Log the registered commands in each guild
    for (const guild of client.guilds.cache.values()) {
      try {
        const guildCommands = await guild.commands.fetch();
        logger.info(
          `Commands in guild ${guild.name}:`,
          guildCommands.map((cmd) => ({
            name: cmd.name,
            description: cmd.description,
            options: cmd.options.map((opt) => ({
              name: opt.name,
              type: opt.type,
              description: opt.description,
            })),
          }))
        );
      } catch (error) {
        logger.error(`Failed to fetch commands in guild ${guild.name}:`, {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    // Clean up
    client.destroy();
    logger.info("Test command registration complete");
  } catch (error) {
    logger.error("Failed to register test commands:", {
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

// Run the registration
registerTestCommands();
