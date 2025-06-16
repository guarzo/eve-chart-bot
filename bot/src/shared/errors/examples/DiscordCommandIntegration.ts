import { ChatInputCommandInteraction } from 'discord.js';
import { errorHandler, DiscordError, createDiscordErrorResponse } from '../index';
import { logger } from '../../../lib/logger';

/**
 * Example: Enhanced Discord command handler with standardized error handling
 */
export async function handleKillsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const correlationId = errorHandler.createCorrelationId();
  
  try {
    // Add correlation ID to interaction context for tracking
    (interaction as any).correlationId = correlationId;

    await interaction.deferReply();

    // Extract command parameters
    const characterIds = interaction.options.getString('characters', true).split(',');
    const period = interaction.options.getString('period') || '24h';
    const chartType = interaction.options.getString('type') || 'kills';

    // Validate input
    if (characterIds.length === 0) {
      throw DiscordError.commandError(
        'kills',
        'No character IDs provided',
        {
          // correlationId removed
          userId: interaction.user.id,
          guildId: interaction.guildId || undefined,
          operation: 'kills_command',
          metadata: { interactionId: interaction.id },
        }
      );
    }

    if (characterIds.length > 10) {
      throw DiscordError.commandError(
        'kills',
        'Too many characters specified (max: 10)',
        {
          // correlationId removed
          userId: interaction.user.id,
          guildId: interaction.guildId || undefined,
          operation: 'kills_command',
          metadata: { 
            interactionId: interaction.id,
            characterCount: characterIds.length,
          },
        }
      );
    }

    // Process the command with error handling
    const result = await errorHandler.withRetry(
      async () => {
        // Your chart generation logic here
        return await generateKillsChart(characterIds, period, chartType);
      },
      3, // max attempts
      1000, // base delay
      {
        // correlationId removed
        operation: 'generate_kills_chart',
        userId: interaction.user.id,
        guildId: interaction.guildId || undefined,
        metadata: {
          characterIds,
          period,
          chartType,
        },
      }
    );

    // Send successful response
    await interaction.editReply({
      content: `Here's your ${chartType} chart for the last ${period}:`,
      files: [{ attachment: result.buffer, name: `kills-${period}.png` }],
    });

    logger.info('Kills command completed successfully', {
      correlationId,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      characterCount: characterIds.length,
      period,
      chartType,
    });

  } catch (error) {
    // Handle error with full context
    const standardizedError = errorHandler.handleDiscordError(
      error,
      'kills',
      interaction.user.id,
      interaction.guildId || undefined,
      interaction.id
    );

    // Create user-friendly Discord response
    const discordResponse = createDiscordErrorResponse(standardizedError);

    try {
      if (interaction.deferred) {
        await interaction.editReply(discordResponse);
      } else {
        await interaction.reply(discordResponse);
      }
    } catch (replyError) {
      // If we can't even send the error message, log it
      logger.error('Failed to send error response to Discord', {
        // correlationId removed
        originalError: standardizedError.toJSON(),
        replyError: replyError instanceof Error ? replyError.message : String(replyError),
      });
    }
  }
}

/**
 * Example: Chart generation function with proper error handling
 */
async function generateKillsChart(
  characterIds: string[],
  _period: string,
  chartType: string
): Promise<{ buffer: Buffer }> {
  // const _correlationId = errorHandler.createCorrelationId();

  try {
    // This would call your actual chart service
    // throw new Error('Chart generation not implemented yet');
    
    return { buffer: Buffer.from('fake chart data') };
  } catch (error) {
    // Convert to chart-specific error
    throw errorHandler.handleChartError(
      error,
      chartType,
      characterIds,
      undefined, // dataSize would be known here
      {
        // correlationId removed
        includeStackTrace: process.env.NODE_ENV === 'development',
      }
    );
  }
}

/**
 * Example: Global Discord error handler for uncaught command errors
 */
export function setupDiscordErrorHandling(client: any): void {
  client.on('interactionCreate', async (interaction: any) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      // Command handling logic would be here
      await handleCommand(interaction);
    } catch (error) {
      const standardizedError = errorHandler.handleDiscordError(
        error,
        interaction.commandName,
        interaction.user.id,
        interaction.guildId,
        interaction.id
      );

      const discordResponse = createDiscordErrorResponse(standardizedError);

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(discordResponse);
        } else {
          await interaction.reply(discordResponse);
        }
      } catch (replyError) {
        logger.error('Failed to send error response', {
          correlationId: standardizedError.context?.correlationId,
          originalError: standardizedError.toJSON(),
          replyError: replyError instanceof Error ? replyError.message : String(replyError),
        });
      }
    }
  });
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  // Command routing logic
  switch (interaction.commandName) {
    case 'kills':
      await handleKillsCommand(interaction);
      break;
    // Add other commands here
    default:
      throw DiscordError.commandError(
        interaction.commandName,
        'Unknown command',
        {
          userId: interaction.user.id,
          guildId: interaction.guildId || undefined,
          operation: interaction.commandName,
        }
      );
  }
}