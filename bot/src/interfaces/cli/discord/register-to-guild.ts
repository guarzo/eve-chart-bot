import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import { commands } from "../../../lib/discord/commands";
import { logger } from "../../../lib/logger";

// Load environment variables
config();

async function registerCommandsToGuild() {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = "576238803824410629"; // FlyGD guild ID

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

    logger.info(
      `Registering ${commands.length} commands for bot ID: ${botId} in guild: ${guildId}`
    );

    // Convert commands to their REST format
    const commandsData = commands.map((command) => command.toJSON());

    // Register commands to specific guild (much faster than global)
    logger.info("Started refreshing guild (/) commands...");

    const data = await rest.put(
      Routes.applicationGuildCommands(botId, guildId),
      { body: commandsData }
    );

    logger.info(
      `Successfully reloaded ${
        Array.isArray(data) ? data.length : 0
      } guild (/) commands.`
    );

    // Log registered commands
    if (Array.isArray(data)) {
      data.forEach((cmd) => {
        logger.info(`- Registered: ${cmd.name}`);

        // If it has subcommands, list them
        if (cmd.options && cmd.options.some((opt: any) => opt.type === 1)) {
          const subcommands = cmd.options.filter((opt: any) => opt.type === 1);
          subcommands.forEach((sub: any) => {
            logger.info(`  • ${sub.name}: ${sub.description}`);
          });
        }
      });
    }
  } catch (error) {
    logger.error("Error registering guild commands:", error);
  }
}

// Run the function
registerCommandsToGuild().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
