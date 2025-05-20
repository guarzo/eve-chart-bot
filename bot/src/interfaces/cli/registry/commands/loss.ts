import { Command } from "commander";
import { logger } from "../../../../lib/logger";
import { RepositoryManager } from "../../../../infrastructure/repositories/RepositoryManager";
import { LossFact } from "../../../../domain/killmail/LossFact";

/**
 * Register loss commands
 */
export function registerLossCommands(program: Command) {
  const lossProgram = program
    .command("loss")
    .description("Loss management commands");

  // List losses command
  lossProgram
    .command("list")
    .description("List losses for a character or group")
    .option("-c, --character <id>", "Character ID")
    .option("-g, --group <id>", "Group ID")
    .option("-s, --start <date>", "Start date (YYYY-MM-DD)")
    .option("-e, --end <date>", "End date (YYYY-MM-DD)")
    .option("-v, --value <amount>", "Minimum ISK value")
    .action(async (options) => {
      const repositoryManager = new RepositoryManager();
      const lossRepo = repositoryManager.getLossRepository();

      try {
        const startDate = options.start
          ? new Date(options.start)
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const endDate = options.end ? new Date(options.end) : new Date();
        const minValue = options.value ? BigInt(options.value) : undefined;

        let losses: LossFact[] = [];

        if (options.character) {
          const characterId = BigInt(options.character);
          losses = await lossRepo.getLossesForCharacter(
            characterId,
            startDate,
            endDate
          );
          if (minValue) {
            losses = losses.filter((loss) => loss.totalValue >= minValue);
          }
        } else if (options.group) {
          const groupId = BigInt(options.group);
          const groupLosses = await lossRepo.getLossesByTimeRange(
            startDate,
            endDate
          );
          losses = groupLosses.filter((loss) => {
            const isInGroup = loss.characterId === groupId;
            return isInGroup && (!minValue || loss.totalValue >= minValue);
          });
        } else {
          logger.error("Either --character or --group must be specified");
          process.exit(1);
        }

        if (losses.length === 0) {
          logger.info("No losses found for the specified criteria");
          return;
        }

        logger.info(`Found ${losses.length} loss records:`);
        losses.forEach((loss) => {
          logger.info(
            `Killmail: ${loss.killmailId}, Character: ${loss.characterId}, ` +
              `Time: ${loss.killTime.toISOString()}, Ship: ${
                loss.shipTypeId
              }, ` +
              `System: ${
                loss.systemId
              }, Value: ${loss.totalValue.toLocaleString()} ISK, ` +
              `Attackers: ${loss.attackerCount}, Labels: ${loss.labels.join(
                ", "
              )}`
          );
        });
      } catch (error) {
        logger.error("Error listing losses:", error);
        process.exit(1);
      } finally {
        await lossRepo.disconnect();
      }
    });

  // Get loss details command
  lossProgram
    .command("details")
    .description("Get details for a specific loss")
    .argument("<killmailId>", "Killmail ID")
    .action(async (killmailId) => {
      const repositoryManager = new RepositoryManager();
      const lossRepo = repositoryManager.getLossRepository();

      try {
        const loss = await lossRepo.getLoss(BigInt(killmailId));

        if (!loss) {
          logger.error(`No loss found with killmail ID ${killmailId}`);
          process.exit(1);
        }

        logger.info("Loss Details:");
        logger.info(`Killmail ID: ${loss.killmailId}`);
        logger.info(`Character ID: ${loss.characterId}`);
        logger.info(`Time: ${loss.killTime.toISOString()}`);
        logger.info(`Ship Type: ${loss.shipTypeId}`);
        logger.info(`System: ${loss.systemId}`);
        logger.info(`Total Value: ${loss.totalValue.toLocaleString()} ISK`);
        logger.info(`Attacker Count: ${loss.attackerCount}`);
        logger.info(`Labels: ${loss.labels.join(", ")}`);
      } catch (error) {
        logger.error("Error getting loss details:", error);
        process.exit(1);
      } finally {
        await lossRepo.disconnect();
      }
    });

  // Cleanup command
  lossProgram
    .command("cleanup")
    .description("Clean up loss data")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (options) => {
      const repositoryManager = new RepositoryManager();
      const lossRepo = repositoryManager.getLossRepository();

      try {
        if (!options.force) {
          logger.warn("WARNING: This will delete all loss data.");
          logger.warn("Press Ctrl+C to cancel or Enter to continue...");

          // Wait for user input
          await new Promise<void>((resolve) => {
            process.stdin.once("data", () => {
              resolve();
            });
          });
        }

        logger.info("Deleting all loss data...");
        await lossRepo.deleteAllLosses();
        logger.info("Loss data cleanup complete");
      } catch (error) {
        logger.error("Error cleaning up loss data:", error);
        process.exit(1);
      } finally {
        await lossRepo.disconnect();
      }
    });
}
