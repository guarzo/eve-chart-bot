import { config } from "dotenv";
import { Client, GatewayIntentBits, Events, Interaction } from "discord.js";
import { logger } from "../../../lib/logger";
import { commands } from "../../../lib/discord/commands";
import { handleKillsCommand, handleMapCommand } from "../../../lib/discord/handlers";

// Load environment variables
config();

async function testDiscordBot() {
  try {
    logger.info("Starting Discord bot test...");

    // Check environment variables
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error("DISCORD_BOT_TOKEN environment variable is not set");
    }
    logger.info("Found Discord token in environment");
    logger.debug("Token starts with:", token.substring(0, 10) + "...");

    // Initialize Discord client
    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    // Set up event handlers
    client.on(Events.ClientReady, async () => {
      logger.info(`Bot logged in as ${client.user?.tag}`);

      // Register commands
      logger.info("Registering commands...");
      const application = client.application;
      if (!application) {
        throw new Error("Application not available");
      }

      try {
        // Convert commands to JSON format
        const jsonCommands = commands.map((cmd) => cmd.toJSON());
        logger.info("Registering commands:", jsonCommands);
        await application.commands.set(jsonCommands);
        logger.info("Successfully registered commands");
      } catch (error) {
        logger.error("Failed to register commands:", {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  name: error.name,
                  stack: error.stack,
                }
              : error,
        });
        throw error;
      }
    });

    client.on(Events.Error, (error) => {
      logger.error("Discord client error:", {
        error:
          error instanceof Error
            ? {
                message: error.message,
                name: error.name,
                stack: error.stack,
              }
            : error,
      });
    });

    client.on(Events.Debug, (info) => {
      logger.debug("Discord debug info:", info);
    });

    client.on(Events.Warn, (info) => {
      logger.warn("Discord warning:", info);
    });

    // Handle slash commands
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      logger.info("Received interaction:", {
        type: interaction.type,
        isCommand: interaction.isCommand(),
        commandName: interaction.isCommand()
          ? interaction.commandName
          : undefined,
        user: interaction.user?.tag,
        guild: interaction.guild?.name,
        channel: interaction.channel?.id,
      });

      if (!interaction.isCommand()) {
        logger.info("Ignoring non-command interaction");
        return;
      }

      try {
        logger.info(`Processing command: ${interaction.commandName}`);
        switch (interaction.commandName) {
          case "kills":
            logger.info("Handling kills command");
            await handleKillsCommand(interaction);
            break;
          case "map":
            logger.info("Handling map command");
            await handleMapCommand(interaction);
            break;
          default:
            logger.warn(`Unknown command: ${interaction.commandName}`);
            await interaction.reply({
              content: "Unknown command",
              ephemeral: true,
            });
        }
      } catch (error) {
        logger.error("Error handling command:", {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  name: error.name,
                  stack: error.stack,
                }
              : error,
        });
        const errorMessage =
          "Sorry, there was an error processing your command.";

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: errorMessage,
            ephemeral: true,
          });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    });

    // Login to Discord
    logger.info("Logging in to Discord...");
    await client.login(token);
    logger.info("Successfully logged in to Discord");

    // Keep the script running
    process.on("SIGINT", () => {
      logger.info("Shutting down bot...");
      client.destroy();
      process.exit(0);
    });
  } catch (error) {
    logger.error("Failed to start Discord bot:", {
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

// Run the test
testDiscordBot();
