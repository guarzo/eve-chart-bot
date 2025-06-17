import { CommandInteraction, MessageFlags } from 'discord.js';
import { ValidatedChartCommandRegistry } from './validatedRegistry';
import { logger } from '../../logger';

/**
 * Main handler for the /charts command with validation
 * Delegates to appropriate validated subcommand handlers
 */
export class ValidatedChartsCommandHandler {
  private registry: ValidatedChartCommandRegistry;

  constructor() {
    this.registry = new ValidatedChartCommandRegistry();
  }

  /**
   * Handle a chart command interaction
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    logger.info(
      `ValidatedChartsCommandHandler.handle() called - interaction state: replied=${interaction.replied}, deferred=${interaction.deferred}`
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
    logger.info(`Handling validated charts subcommand: ${subcommand}`);
    logger.info(
      `Pre-handler interaction state: replied=${interaction.replied}, deferred=${interaction.deferred}, id=${interaction.id}`
    );

    // Get handler from registry
    const handler = this.registry.getHandler(subcommand);

    if (handler) {
      logger.info(`Found validated handler for subcommand: ${subcommand}, calling handler.handle()`);
      await handler.handle(interaction);
      logger.info(`Validated handler completed for subcommand: ${subcommand}`);
    } else {
      logger.warn(`No validated handler found for subcommand: ${subcommand}`);
      const availableCommands = this.registry.getAvailableSubcommands().join(', ');

      await interaction.reply({
        content: `Unknown chart command: "${subcommand}". Available options: ${availableCommands}`,
        flags: MessageFlags.Ephemeral,
      });

      logger.warn(`Unknown chart subcommand attempted: ${subcommand}`);
    }
  }
}
