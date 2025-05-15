import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import { commands } from "../../../lib/discord/commands";
import { logger } from "../../../lib/logger";

// Load environment variables
config();

async function registerCommands() {
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!botToken) {
    logger.error("DISCORD_BOT_TOKEN is not set in environment variables");
    process.exit(1);
  }

  try {
    // Create a REST instance
    const rest = new REST({ version: "10" }).setToken(botToken);

    // Extract the bot ID from the token
    const tokenParts = botToken.split(".");
    if (tokenParts.length < 2) {
      logger.error("Invalid bot token format");
      process.exit(1);
    }

    // Base64 decode the first part of the token to get the bot ID
    const payload = Buffer.from(tokenParts[0], "base64").toString();
    const botId = JSON.parse(payload).id || payload;

    logger.info(`Registering ${commands.length} commands for bot ID: ${botId}`);

    // Convert commands to their REST format
    const commandsData = commands.map((command) => command.toJSON());

    // Register commands globally
    logger.info("Started refreshing application (/) commands...");

    const data = await rest.put(Routes.applicationCommands(botId), {
      body: commandsData,
    });

    logger.info(
      `Successfully reloaded ${
        Array.isArray(data) ? data.length : 0
      } application (/) commands.`
    );

    // Log registered commands
    if (Array.isArray(data)) {
      data.forEach((cmd) => {
        logger.info(`- Registered: ${cmd.name}`);
      });
    }
  } catch (error) {
    logger.error("Error registering commands:", error);
  }
}

registerCommands().then(() => {
  logger.info("Command registration script completed");
  process.exit(0);
});
