import { Command } from "commander";
import { logger } from "../../../../lib/logger";
import { KillmailIngestionService } from "../../../../services/ingestion/KillmailIngestionService";

/**
 * Register killmail commands
 */
export function registerKillmailCommands(program: Command) {
  const killmailProgram = program
    .command("killmail")
    .description("Killmail management commands");

  // Sync killmails command
  killmailProgram
    .command("sync")
    .description("Sync killmails for a character")
    .argument("<characterId>", "Character ID")
    .option("-d, --days <number>", "Number of days to backfill", "30")
    .action(async (characterId, options) => {
      const killmailService = new KillmailIngestionService();

      try {
        await killmailService.backfillKills(BigInt(characterId));
        logger.info("Killmail sync completed successfully");
      } catch (error: any) {
        logger.error(`Error syncing killmails: ${error.message}`);
        process.exit(1);
      }
    });

  // Get killmail details command
  killmailProgram
    .command("get")
    .description("Get killmail details")
    .argument("<killmailId>", "Killmail ID")
    .action(async (killmailId) => {
      const killmailService = new KillmailIngestionService();

      try {
        const result = await killmailService.ingestKillmail(
          parseInt(killmailId)
        );
        if (!result.success) {
          if (result.existing) {
            logger.info(`Killmail ${killmailId} already exists in database`);
          } else {
            logger.error(
              `Failed to get killmail ${killmailId}: ${result.error}`
            );
            process.exit(1);
          }
        } else {
          logger.info("Killmail details:");
          logger.info(`- Time: ${result.timestamp}`);
          logger.info(`- Age: ${result.age} hours`);
        }
      } catch (error: any) {
        logger.error(`Error getting killmail: ${error.message}`);
        process.exit(1);
      }
    });

  // Cleanup command
  killmailProgram
    .command("cleanup")
    .description("Clean up killmail data")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (options) => {
      const killmailService = new KillmailIngestionService();

      try {
        if (!options.force) {
          logger.warn("WARNING: This will delete all killmail data.");
          logger.warn("Press Ctrl+C to cancel or Enter to continue...");

          // Wait for user input
          await new Promise<void>((resolve) => {
            process.stdin.once("data", () => {
              resolve();
            });
          });
        }

        await killmailService.cleanup();
      } catch (error: any) {
        logger.error(`Error cleaning up killmail data: ${error.message}`);
        process.exit(1);
      }
    });
}
