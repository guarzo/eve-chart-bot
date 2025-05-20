import { logger } from "../../../lib/logger";
import { KillmailIngestionService } from "../../../services/ingestion/KillmailIngestionService";

async function main() {
  try {
    const killmailService = new KillmailIngestionService();

    // Get all characters
    const characters = await killmailService.prisma.character.findMany();
    logger.info(`Found ${characters.length} characters to sync`);

    // Sync kills for each character
    for (const character of characters) {
      logger.info(
        `Syncing kills for character ${character.name} (${character.eveId})`
      );
      await killmailService.backfillKills(parseInt(character.eveId));

      // Log kill count
      const characterKills = await killmailService.prisma.killFact.count({
        where: {
          attackers: {
            some: {
              character_id: BigInt(character.eveId),
            },
          },
        },
      });
      logger.info(`Character has ${characterKills} kills`);

      // Log recent kills
      const recentKills = await killmailService.prisma.killFact.findMany({
        where: {
          attackers: {
            some: {
              character_id: BigInt(character.eveId),
            },
          },
        },
        orderBy: {
          killmail_time: "desc",
        },
        take: 5,
      });

      if (recentKills.length > 0) {
        logger.info("Recent kills:");
        for (const kill of recentKills) {
          logger.info(`- ${kill.killmail_time}`);
        }
      }
    }

    await killmailService.close();
  } catch (error: any) {
    logger.error(`Error syncing kills: ${error.message}`);
    process.exit(1);
  }
}

main();
