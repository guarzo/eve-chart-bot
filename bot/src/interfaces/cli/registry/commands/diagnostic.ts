import { Command } from "commander";
import { logger } from "../../../../lib/logger";
import { RepositoryManager } from "../../../../infrastructure/repositories/RepositoryManager";
import { Killmail } from "../../../../domain/killmail/Killmail";

export function registerDiagnosticCommands(program: Command) {
  const diagProgram = program
    .command("diagnostic")
    .description("Diagnostic and debugging commands");

  // Check character kills command
  diagProgram
    .command("check-character-kills")
    .description("Check killmail data for a character")
    .requiredOption("-c, --character <id>", "Character ID to check")
    .option("-d, --days <number>", "Number of days to check", "7")
    .action(async (options) => {
      try {
        const repositoryManager = new RepositoryManager();
        const killRepo = repositoryManager.getKillRepository();
        const characterRepo = repositoryManager.getCharacterRepository();
        const days = parseInt(options.days);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        logger.info(
          `Checking kills for character ${options.character} in the last ${days} days...`
        );

        const character = await characterRepo.getCharacter(options.character);
        if (!character) {
          logger.error(`Character ${options.character} not found`);
          process.exit(1);
        }

        const killmails = await killRepo.getKillsForCharacter(
          options.character,
          startDate,
          new Date()
        );

        logger.info(`Found ${killmails.length} killmails:`);
        killmails.forEach((kill: Killmail) => {
          logger.info(`- Killmail ${kill.killmailId} (${kill.killTime})`);
          if (kill.attackers) {
            logger.info(
              `  Attackers: ${kill.attackers
                .map((a) => a.characterId?.toString() || "Unknown")
                .join(", ")}`
            );
          }
          if (kill.victim) {
            logger.info(
              `  Victim: ${kill.victim.characterId?.toString() || "Unknown"}`
            );
          }
        });

        await killRepo.disconnect();
      } catch (error) {
        logger.error("Error checking character kills:", error);
        process.exit(1);
      }
    });

  // Check kills chart command
  diagProgram
    .command("check-kills-chart")
    .description("Check kills chart generation")
    .requiredOption("-c, --character <id>", "Character ID to check")
    .option("-d, --days <number>", "Number of days to check", "30")
    .action(async (options) => {
      try {
        const repositoryManager = new RepositoryManager();
        const killRepo = repositoryManager.getKillRepository();
        const characterRepo = repositoryManager.getCharacterRepository();
        const days = parseInt(options.days);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        logger.info(
          `Checking kills chart data for character ${options.character} in the last ${days} days...`
        );

        const character = await characterRepo.getCharacter(options.character);
        if (!character) {
          logger.error(`Character ${options.character} not found`);
          process.exit(1);
        }

        const killmails = await killRepo.getKillsForCharacter(
          options.character,
          startDate,
          new Date()
        );

        // Group kills by day
        const killsByDay = new Map<string, number>();
        killmails.forEach((kill: Killmail) => {
          const date = kill.killTime.toISOString().split("T")[0];
          killsByDay.set(date, (killsByDay.get(date) || 0) + 1);
        });

        logger.info("Kills by day:");
        for (const [date, count] of killsByDay) {
          logger.info(`- ${date}: ${count} kills`);
        }

        await killRepo.disconnect();
      } catch (error) {
        logger.error("Error checking kills chart:", error);
        process.exit(1);
      }
    });

  // Check kill ingestion command
  diagProgram
    .command("check-kill-ingestion")
    .description("Check killmail ingestion process")
    .option("-d, --days <number>", "Number of days to check", "7")
    .action(async (options) => {
      try {
        const repositoryManager = new RepositoryManager();
        const killRepo = repositoryManager.getKillRepository();
        const days = parseInt(options.days);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        logger.info(`Checking killmail ingestion for the last ${days} days...`);

        const killmails = await killRepo.getKillsInDateRange(
          startDate,
          new Date()
        );

        const totalKills = killmails.length;
        const uniqueCharacters = new Set(
          killmails
            .flatMap((k: Killmail) => [
              ...(k.attackers?.map((a) => a.characterId?.toString()) || []),
              k.victim?.characterId?.toString(),
            ])
            .filter(Boolean)
        ).size;

        logger.info(`Total killmails: ${totalKills}`);
        logger.info(`Unique characters involved: ${uniqueCharacters}`);
        logger.info(`Average kills per day: ${(totalKills / days).toFixed(1)}`);

        // Check for any gaps in ingestion
        const daysWithKills = new Set(
          killmails.map((k: Killmail) => k.killTime.toISOString().split("T")[0])
        );
        const missingDays = [];
        for (let i = 0; i < days; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split("T")[0];
          if (!daysWithKills.has(dateStr)) {
            missingDays.push(dateStr);
          }
        }

        if (missingDays.length > 0) {
          logger.warn("Found days with no killmails:");
          missingDays.forEach((date) => logger.warn(`- ${date}`));
        }

        await killRepo.disconnect();
      } catch (error) {
        logger.error("Error checking killmail ingestion:", error);
        process.exit(1);
      }
    });
}
