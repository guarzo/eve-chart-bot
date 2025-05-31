import { CommandInteraction } from "discord.js";
import { ChartFactory } from "../../../../services/charts";
import { CharacterRepository } from "../../../../infrastructure/repositories/CharacterRepository";
import { logger } from "../../../logger";
import { RepositoryManager } from "../../../../infrastructure/repositories/RepositoryManager";
import { CharacterGroup } from "../../../../domain/character/CharacterGroup";
import { MessageFlags } from "discord.js";

/**
 * Base class for all chart command handlers
 */
export abstract class BaseChartHandler {
  protected chartFactory: ChartFactory;
  protected characterRepository: CharacterRepository;
  protected repositoryManager: RepositoryManager;

  constructor() {
    this.repositoryManager = new RepositoryManager();
    this.chartFactory = new ChartFactory();
    this.characterRepository = this.repositoryManager.getCharacterRepository();
  }

  /**
   * Handle a chart command interaction
   * This method must be implemented by all chart handlers
   */
  abstract handle(interaction: CommandInteraction): Promise<void>;

  /**
   * Convert a time period string to date range
   */
  protected getTimeRange(timePeriod: string = "7"): {
    startDate: Date;
    endDate: Date;
  } {
    const days = parseInt(timePeriod, 10) || 7;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    return { startDate, endDate };
  }

  /**
   * Get all character groups from database and transform them into the format expected by chart generators
   */
  protected async getCharacterGroups(): Promise<
    Array<{
      groupId: string;
      name: string;
      characters: Array<{
        eveId: string;
        name: string;
        mainCharacterId?: string;
      }>;
      mainCharacterId?: string;
    }>
  > {
    try {
      logger.info(
        "BaseChartHandler.getCharacterGroups() - calling characterRepository.getAllCharacterGroups()"
      );
      const groups = await this.characterRepository.getAllCharacterGroups();
      logger.info(
        `BaseChartHandler.getCharacterGroups() - got ${groups.length} raw groups from repository`
      );

      // Filter out groups with no characters and transform to expected format
      const result = groups
        .filter((group: CharacterGroup) => group.characters.length > 0)
        .map((group: CharacterGroup) => ({
          groupId: group.id,
          name: group.name,
          characters: group.characters.map((char) => ({
            eveId: char.eveId,
            name: char.name,
          })),
          mainCharacterId: group.mainCharacterId,
        }));

      logger.info(
        `BaseChartHandler.getCharacterGroups() - returning ${result.length} filtered groups`
      );
      return result;
    } catch (error) {
      logger.error("Error fetching character groups:", {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
        errorType: typeof error,
        errorString: String(error),
      });
      return [];
    }
  }

  /**
   * Handle any errors that occur during command execution
   */
  protected async handleError(
    interaction: CommandInteraction,
    error: any
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error handling chart command: ${errorMessage}`, {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
      interactionId: interaction.id,
      commandName: interaction.commandName,
      subcommand: interaction.isChatInputCommand()
        ? interaction.options.getSubcommand(false)
        : "unknown",
      replied: interaction.replied,
      deferred: interaction.deferred,
    });

    try {
      // Reply with error message
      const content = `❌ Error generating chart: ${errorMessage}`;

      if (interaction.deferred) {
        await interaction.editReply({ content });
      } else if (!interaction.replied) {
        await interaction.reply({
          content,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.followUp({
          content,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError) {
      logger.error("Error sending error response:", replyError);
    }
  }
}
