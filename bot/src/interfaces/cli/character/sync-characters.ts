import { logger } from "../../../lib/logger";
import { CharacterSyncService } from "../../../services/ingestion/CharacterSyncService";

async function main() {
  try {
    const characterService = new CharacterSyncService();

    // Sync characters for the map
    await characterService.syncUserCharacters(process.env.MAP_NAME!);

    // Log character counts
    const totalCharacters = await characterService.prisma.character.count();
    logger.info(`Total characters: ${totalCharacters}`);

    // Log characters by group
    const charactersByGroup = await characterService.prisma.character.groupBy({
      by: ["group"],
      _count: true,
    });

    for (const group of charactersByGroup) {
      logger.info(`Group ${group.group}: ${group._count} characters`);
    }

    await characterService.close();
  } catch (error: any) {
    logger.error(`Error syncing characters: ${error.message}`);
    process.exit(1);
  }
}

main();
