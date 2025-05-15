import { spawn } from "child_process";
import { logger } from "../../../lib/logger";

async function restartBot() {
  logger.info("Restarting the bot service...");

  try {
    // Check if the bot is running using PM2
    const pm2List = spawn("pm2", ["list"]);
    let output = "";

    pm2List.stdout.on("data", (data) => {
      output += data.toString();
    });

    await new Promise<void>((resolve) => {
      pm2List.on("close", (code) => {
        if (code !== 0) {
          logger.warn("PM2 list command failed with code:", code);
        }
        resolve();
      });
    });

    // Restart the bot
    if (output.includes("bot")) {
      logger.info("Bot service is running, restarting...");
      const restart = spawn("pm2", ["restart", "bot"]);

      restart.stdout.on("data", (data) => {
        logger.info("PM2 restart output:", data.toString().trim());
      });

      restart.stderr.on("data", (data) => {
        logger.error("PM2 restart error:", data.toString().trim());
      });

      await new Promise<void>((resolve) => {
        restart.on("close", (code) => {
          if (code === 0) {
            logger.info("Bot service restarted successfully");
          } else {
            logger.error("Bot service restart failed with code:", code);
          }
          resolve();
        });
      });
    } else {
      logger.info("Bot service not found in PM2, starting...");
      const start = spawn("pm2", ["start", "ecosystem.config.js"]);

      start.stdout.on("data", (data) => {
        logger.info("PM2 start output:", data.toString().trim());
      });

      start.stderr.on("data", (data) => {
        logger.error("PM2 start error:", data.toString().trim());
      });

      await new Promise<void>((resolve) => {
        start.on("close", (code) => {
          if (code === 0) {
            logger.info("Bot service started successfully");
          } else {
            logger.error("Bot service start failed with code:", code);
          }
          resolve();
        });
      });
    }
  } catch (error) {
    logger.error("Error restarting bot service:", error);
  }
}

restartBot().then(() => {
  logger.info("Restart script completed");
  process.exit(0);
});
