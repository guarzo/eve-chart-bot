import { CommandInteraction, MessageFlags } from 'discord.js';
import { ChartCommandRegistry } from './registry';
import { logger } from '../../logger';

/**
 * Main handler for the /charts command
 * Delegates to appropriate subcommand handlers
 */
export class ChartsCommandHandler {
  private registry: ChartCommandRegistry;

  constructor() {
    this.registry = new ChartCommandRegistry();
  }

  /**
   * Handle a chart command interaction
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    logger.info(
      `ChartsCommandHandler.handle() called - interaction state: replied=${interaction.replied}, deferred=${interaction.deferred}`
    );

    if (!interaction.isChatInputCommand()) {
      logger.info('Interaction is not a chat input command');
      await interaction.reply({
        content: 'This command can only be used as a slash command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    logger.info(`Handling charts subcommand: ${subcommand}`);
    logger.info(
      `Pre-handler interaction state: replied=${interaction.replied}, deferred=${interaction.deferred}, id=${interaction.id}`
    );

    // Get handler from registry
    const handler = this.registry.getHandler(subcommand);

    if (handler) {
      logger.info(`Found handler for subcommand: ${subcommand}, calling handler.handle()`);
      await handler.handle(interaction);
      logger.info(`Handler completed for subcommand: ${subcommand}`);
    } else {
      logger.warn(`No handler found for subcommand: ${subcommand}`);
      const availableCommands = this.registry.getAvailableSubcommands().join(', ');

      await interaction.reply({
        content: `Unknown chart command: "${subcommand}". Available options: ${availableCommands}`,
        flags: MessageFlags.Ephemeral,
      });

      logger.warn(`Unknown chart subcommand attempted: ${subcommand}`);
    }
  }
}
