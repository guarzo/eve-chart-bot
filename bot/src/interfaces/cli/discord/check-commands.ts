import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import { logger } from "../../../lib/logger";

// Load environment variables
config();

async function checkRegisteredCommands() {
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

    logger.info(`Checking registered commands for bot ID: ${botId}`);

    // Fetch registered commands
    const commands = await rest.get(Routes.applicationCommands(botId));

    if (Array.isArray(commands) && commands.length > 0) {
      logger.info(
        `Found ${commands.length} registered application (/) commands:`
      );

      commands.forEach((cmd: any) => {
        logger.info(`- ${cmd.name}: ${cmd.description}`);

        // If it has subcommands, list them
        if (cmd.options && cmd.options.some((opt: any) => opt.type === 1)) {
          const subcommands = cmd.options.filter((opt: any) => opt.type === 1);
          subcommands.forEach((sub: any) => {
            logger.info(`  • ${sub.name}: ${sub.description}`);
          });
        }
      });
    } else {
      logger.info("No commands are registered for this bot.");
    }
  } catch (error) {
    logger.error("Error checking registered commands:", error);
  }
}

checkRegisteredCommands().then(() => {
  logger.info("Command check script completed");
  process.exit(0);
});
