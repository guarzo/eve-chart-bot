import { CommandInteraction } from "discord.js";
import { ChartCommandRegistry } from "./registry";
import { logger } from "../../logger";

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
    if (!interaction.isChatInputCommand()) {
      await interaction.reply({
        content: "This command can only be used as a slash command.",
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    logger.info(`Handling charts subcommand: ${subcommand}`);

    // Get handler from registry
    const handler = this.registry.getHandler(subcommand);

    if (handler) {
      await handler.handle(interaction);
    } else {
      const availableCommands = this.registry
        .getAvailableSubcommands()
        .join(", ");

      await interaction.reply({
        content: `Unknown chart command: "${subcommand}". Available options: ${availableCommands}`,
        ephemeral: true,
      });

      logger.warn(`Unknown chart subcommand attempted: ${subcommand}`);
    }
  }
}
