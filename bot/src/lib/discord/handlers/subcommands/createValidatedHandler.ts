import { CommandInteraction } from 'discord.js';
import { BaseChartHandler } from './BaseChartHandler';
import { ValidatedBaseChartHandler } from './ValidatedBaseChartHandler';
import { CommandName } from '../../validation/schemas';

/**
 * Factory function to create a validated handler from an existing handler
 * This allows gradual migration of existing handlers to use validation
 */
export function createValidatedHandler(
  Handler: typeof BaseChartHandler,
  commandName: CommandName,
  useStrictRateLimit: boolean = false
): new () => BaseChartHandler {
  return class ConcreteValidatedHandler extends ValidatedBaseChartHandler {
    protected override readonly commandName = commandName;
    protected override readonly useStrictRateLimit = useStrictRateLimit;
    private innerHandler: BaseChartHandler;

    constructor() {
      super();
      // @ts-ignore - Handler might have different constructor signature
      this.innerHandler = new Handler();
    }

    protected override async handleValidated(interaction: CommandInteraction, validatedData: any): Promise<void> {
      // Monkey-patch the interaction to use validated data
      if (interaction.isChatInputCommand()) {
        const originalGetString = interaction.options.getString.bind(interaction.options);

        // Override getString to return validated data
        interaction.options.getString = (name: string) => {
          if (name in validatedData) {
            return validatedData[name]?.toString() || null;
          }
          return originalGetString(name);
        };
      }

      // Call the original handler
      await this.innerHandler.handle(interaction);
    }
  };
}
