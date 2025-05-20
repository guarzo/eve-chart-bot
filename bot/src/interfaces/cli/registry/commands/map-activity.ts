import { Command } from "commander";
import { logger } from "../../../../lib/logger";
import { RepositoryManager } from "../../../../infrastructure/repositories/RepositoryManager";
import { MapActivity } from "../../../../domain/activity/MapActivity";

/**
 * Register map activity commands
 */
export function registerMapActivityCommands(program: Command) {
  const mapProgram = program
    .command("map-activity")
    .description("Map activity management commands");

  // List map activity command
  mapProgram
    .command("list")
    .description("List map activity for a character or group")
    .option("-c, --character <id>", "Character ID")
    .option("-g, --group <id>", "Group ID")
    .option("-s, --start <date>", "Start date (YYYY-MM-DD)")
    .option("-e, --end <date>", "End date (YYYY-MM-DD)")
    .action(async (options) => {
      const repositoryManager = new RepositoryManager();
      const mapActivityRepo = repositoryManager.getMapActivityRepository();

      try {
        const startDate = options.start
          ? new Date(options.start)
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const endDate = options.end ? new Date(options.end) : new Date();

        let activities: MapActivity[] = [];

        if (options.character) {
          activities = await mapActivityRepo.getActivityForCharacter(
            options.character,
            startDate,
            endDate
          );
        } else if (options.group) {
          activities = await mapActivityRepo.getActivityForGroup(
            options.group,
            startDate,
            endDate
          );
        } else {
          logger.error("Either --character or --group must be specified");
          process.exit(1);
        }

        if (activities.length === 0) {
          logger.info("No map activity found for the specified criteria");
          return;
        }

        logger.info(`Found ${activities.length} map activity records:`);
        activities.forEach((activity) => {
          logger.info(
            `Character: ${
              activity.characterId
            }, Time: ${activity.timestamp.toISOString()}, ` +
              `Signatures: ${activity.signatures}, Connections: ${activity.connections}, ` +
              `Passages: ${activity.passages}`
          );
        });
      } catch (error) {
        logger.error("Error listing map activity:", error);
        process.exit(1);
      } finally {
        await mapActivityRepo.disconnect();
      }
    });

  // Get stats command
  mapProgram
    .command("stats")
    .description("Get map activity statistics")
    .option("-c, --character <id>", "Character ID")
    .option("-g, --group <id>", "Group ID")
    .option("-s, --start <date>", "Start date (YYYY-MM-DD)")
    .option("-e, --end <date>", "End date (YYYY-MM-DD)")
    .action(async (options) => {
      const repositoryManager = new RepositoryManager();
      const mapActivityRepo = repositoryManager.getMapActivityRepository();

      try {
        const startDate = options.start
          ? new Date(options.start)
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const endDate = options.end ? new Date(options.end) : new Date();

        let stats;

        if (options.character) {
          stats = await mapActivityRepo.getActivityStats(
            options.character,
            startDate,
            endDate
          );
        } else if (options.group) {
          stats = await mapActivityRepo.getGroupActivityStats(
            options.group,
            startDate,
            endDate
          );
        } else {
          logger.error("Either --character or --group must be specified");
          process.exit(1);
        }

        logger.info("Map Activity Statistics:");
        logger.info(`Total Systems: ${stats.totalSystems}`);
        logger.info(`Total Signatures: ${stats.totalSignatures}`);
        logger.info(
          `Average Signatures per System: ${stats.averageSignaturesPerSystem.toFixed(
            2
          )}`
        );
      } catch (error) {
        logger.error("Error getting map activity stats:", error);
        process.exit(1);
      } finally {
        await mapActivityRepo.disconnect();
      }
    });

  // Cleanup command
  mapProgram
    .command("cleanup")
    .description("Clean up map activity data")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (options) => {
      const repositoryManager = new RepositoryManager();
      const mapActivityRepo = repositoryManager.getMapActivityRepository();

      try {
        if (!options.force) {
          logger.warn("WARNING: This will delete all map activity data.");
          logger.warn("Press Ctrl+C to cancel or Enter to continue...");

          // Wait for user input
          await new Promise<void>((resolve) => {
            process.stdin.once("data", () => {
              resolve();
            });
          });
        }

        logger.info("Deleting all map activity data...");
        await mapActivityRepo.deleteAllMapActivity();
        logger.info("Map activity data cleanup complete");
      } catch (error) {
        logger.error("Error cleaning up map activity data:", error);
        process.exit(1);
      } finally {
        await mapActivityRepo.disconnect();
      }
    });
}
