import { CommandInteraction } from 'discord.js';
import { ChartFactory } from '../../../../services/charts';
import { CharacterRepository } from '../../../../infrastructure/repositories/CharacterRepository';
import { logger } from '../../../logger';
import { RepositoryManager } from '../../../../infrastructure/repositories/RepositoryManager';
import { CharacterGroup } from '../../../../domain/character/CharacterGroup';
import { MessageFlags } from 'discord.js';
import { errorHandler, createDiscordErrorResponse } from '../../../../shared/errors';

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
  protected getTimeRange(timePeriod: string = '7'): {
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
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      logger.info('BaseChartHandler.getCharacterGroups() - calling characterRepository.getAllCharacterGroups()', {
        correlationId,
      });

      const groups = await errorHandler.withRetry(
        async () => {
          return await this.characterRepository.getAllCharacterGroups();
        },
        3,
        1000,
        {
          correlationId,
          operation: 'db.getAllCharacterGroups',
        }
      );

      logger.info(`BaseChartHandler.getCharacterGroups() - got ${groups.length} raw groups from repository`, {
        correlationId,
        groupCount: groups.length,
      });

      // Filter out groups with no characters and transform to expected format
      const result = groups
        .filter((group: CharacterGroup) => group.characters.length > 0)
        .map((group: CharacterGroup) => ({
          groupId: group.id,
          name: group.name,
          characters: group.characters.map(char => ({
            eveId: char.eveId,
            name: char.name,
          })),
          mainCharacterId: group.mainCharacterId,
        }));

      logger.info(`BaseChartHandler.getCharacterGroups() - returning ${result.length} filtered groups`, {
        correlationId,
        filteredGroupCount: result.length,
      });
      
      return result;
    } catch (error) {
      const dbError = errorHandler.handleDatabaseError(
        error,
        'read',
        'character_group',
        undefined,
        {
          correlationId,
          operation: 'getAllCharacterGroups',
        }
      );

      logger.warn('Error fetching character groups, returning empty array', dbError.toLogFormat());
      return [];
    }
  }

  /**
   * Handle any errors that occur during command execution
   */
  protected async handleError(interaction: CommandInteraction, error: any): Promise<void> {
    const subcommand = interaction.isChatInputCommand() ? interaction.options.getSubcommand(false) : 'unknown';
    
    // Handle the error with full context using the new error handling system
    const standardizedError = errorHandler.handleDiscordError(
      error,
      interaction.commandName,
      interaction.user.id,
      interaction.guildId || undefined,
      interaction.id
    );

    // Create user-friendly Discord response
    const discordResponse = createDiscordErrorResponse(standardizedError);

    try {
      if (interaction.deferred) {
        await interaction.editReply(discordResponse);
      } else if (!interaction.replied) {
        await interaction.reply({
          ...discordResponse,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.followUp({
          ...discordResponse,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError) {
      const replyErrorHandled = errorHandler.handleDiscordError(
        replyError,
        'error_response',
        interaction.user.id,
        interaction.guildId || undefined,
        interaction.id
      );

      logger.error('Failed to send error response to Discord', {
        originalError: standardizedError.toJSON(),
        replyError: replyErrorHandled.toJSON(),
        interactionState: {
          deferred: interaction.deferred,
          replied: interaction.replied,
          commandName: interaction.commandName,
          subcommand,
        },
      });
    }
  }
}
