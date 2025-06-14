import { CommandInteraction, MessageFlags } from 'discord.js';
import { BaseChartHandler } from './BaseChartHandler';
import { validateCommand, validateInteraction, logCommandUsage, CommandName } from '../../validation';
import { logger } from '../../../logger';

/**
 * Enhanced base class for chart handlers with built-in validation and rate limiting
 */
export abstract class ValidatedBaseChartHandler extends BaseChartHandler {
  /**
   * The command name for validation purposes
   */
  protected abstract readonly commandName: CommandName;

  /**
   * Whether to use strict rate limiting for this command
   */
  protected readonly useStrictRateLimit: boolean = false;

  /**
   * Handle the command with validation and rate limiting
   */
  override async handle(interaction: CommandInteraction): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      // Perform validation and rate limiting
      const validationResult = await validateInteraction(interaction, {
        customRateLimitConfig: this.useStrictRateLimit
          ? {
              maxRequests: 3,
              windowMs: 60000,
            }
          : undefined,
      });

      if (!validationResult.valid) {
        error = validationResult.error;
        return;
      }

      // Validate command parameters
      const commandValidation = await validateCommand(interaction, this.commandName);

      if (!commandValidation.success) {
        error = commandValidation.error ?? 'Invalid parameters';

        // Send user-friendly error message
        const errorDetails = commandValidation.details?.errors
          .map(err => `• ${err.path.join('.')}: ${err.message}`)
          .join('\n');

        await interaction.reply({
          content: `❌ Invalid command parameters:\n${errorDetails ?? error}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Call the implementation with validated data
      await this.handleValidated(interaction, commandValidation.data);
      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      await this.handleError(interaction, err);
    } finally {
      // Log command usage
      logCommandUsage(interaction, success, error);

      // Log performance metrics
      const duration = Date.now() - startTime;
      logger.info(`Command execution completed in ${duration}ms`, {
        command: this.commandName,
        duration,
        success,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
    }
  }

  /**
   * Handle the command with validated data
   * This method must be implemented by subclasses
   */
  protected abstract handleValidated(interaction: CommandInteraction, validatedData: any): Promise<void>;

  /**
   * Enhanced error handler with better error messages
   */
  protected override async handleError(interaction: CommandInteraction, error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log detailed error information
    logger.error(`Error in ${this.commandName} command:`, {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
      command: this.commandName,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      interactionId: interaction.id,
    });

    // Determine user-friendly error message
    let userMessage = '❌ An error occurred while generating the chart.';

    // Common error patterns
    if (errorMessage.includes('timeout')) {
      userMessage = '❌ The request timed out. Please try again with a smaller time range.';
    } else if (errorMessage.includes('rate limit')) {
      userMessage = '❌ You are being rate limited. Please try again later.';
    } else if (errorMessage.includes('no data')) {
      userMessage = '❌ No data found for the specified time period.';
    } else if (errorMessage.includes('permission')) {
      userMessage = '❌ You do not have permission to use this command.';
    }

    try {
      const content = userMessage;

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
      logger.error('Error sending error response:', replyError);
    }
  }
}
