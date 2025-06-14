import { CommandInteraction, MessageFlags } from 'discord.js';
import { logger } from '../logger';
import { ValidatedChartsCommandHandler } from './handlers/ValidatedChartsCommandHandler';
import { validateInteraction, logCommandUsage } from './validation';

/**
 * Enhanced chart command handler with validation and security
 */
export async function handleValidatedChartsCommand(interaction: CommandInteraction): Promise<void> {
  const startTime = Date.now();
  let success = false;
  let error: string | undefined;

  try {
    // Global validation for the charts command
    const validationResult = await validateInteraction(interaction);

    if (!validationResult.valid) {
      error = validationResult.error;
      logCommandUsage(interaction, false, error);
      return;
    }

    // Use the validated ChartsCommandHandler which will handle subcommand validation
    const handler = new ValidatedChartsCommandHandler();
    await handler.handle(interaction);

    success = true;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    logger.error('Error in validated charts command:', {
      error: err,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    try {
      const errorMessage = 'An error occurred while processing your command.';

      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else if (!interaction.replied) {
        await interaction.reply({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.followUp({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError) {
      logger.error('Failed to send error response:', replyError);
    }
  } finally {
    // Log command usage
    logCommandUsage(interaction, success, error);

    // Log performance metrics
    const duration = Date.now() - startTime;
    logger.info(`Charts command completed in ${duration}ms`, {
      duration,
      success,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
  }
}
