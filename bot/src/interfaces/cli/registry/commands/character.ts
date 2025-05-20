import { Command } from "commander";
import { logger } from "../../../../lib/logger";
import { CharacterIngestionService } from "../../../../services/ingestion/CharacterIngestionService";

/**
 * Register character commands
 */
export function registerCharacterCommands(program: Command) {
  const characterProgram = program
    .command("character")
    .description("Character management commands");

  // Sync characters command
  characterProgram
    .command("sync")
    .description("Sync characters from Map API")
    .argument("<mapName>", "Name of the map to sync characters from")
    .action(async (mapName) => {
      const characterService = new CharacterIngestionService(
        process.env.MAP_API_URL!,
        process.env.MAP_API_KEY!
      );

      try {
        await characterService.syncUserCharacters(mapName);
        logger.info("Character sync completed successfully");
      } catch (error: any) {
        logger.error(`Error syncing characters: ${error.message}`);
        process.exit(1);
      }
    });

  // Update checkpoint command
  characterProgram
    .command("update-checkpoint")
    .description("Update ingestion checkpoint for a character")
    .argument("<characterId>", "Character ID")
    .argument("<type>", "Checkpoint type (kills/losses)")
    .argument("<lastSeenId>", "Last seen ID")
    .action(async (characterId, type, lastSeenId) => {
      const characterService = new CharacterIngestionService(
        process.env.MAP_API_URL!,
        process.env.MAP_API_KEY!
      );

      try {
        await characterService.updateIngestionCheckpoint(
          type,
          characterId,
          BigInt(lastSeenId)
        );
        logger.info("Checkpoint updated successfully");
      } catch (error: any) {
        logger.error(`Error updating checkpoint: ${error.message}`);
        process.exit(1);
      }
    });

  // Update backfill timestamp command
  characterProgram
    .command("update-backfill")
    .description("Update last backfill timestamp for a character")
    .argument("<characterId>", "Character ID")
    .action(async (characterId) => {
      const characterService = new CharacterIngestionService(
        process.env.MAP_API_URL!,
        process.env.MAP_API_KEY!
      );

      try {
        await characterService.updateLastBackfillAt(characterId);
        logger.info("Backfill timestamp updated successfully");
      } catch (error: any) {
        logger.error(`Error updating backfill timestamp: ${error.message}`);
        process.exit(1);
      }
    });
}
