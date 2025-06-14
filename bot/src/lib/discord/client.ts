import { Client, GatewayIntentBits, Events, Partials, MessageFlags } from 'discord.js';
import { logger } from '../logger';
import { handleKillsCommand, handleMapCommand } from './handlers';
import { handleChartsCommand } from './chartHandlers';
import { handleValidatedChartsCommand } from './validatedChartHandlers';

export class DiscordClient {
  public client: Client;

  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      partials: [Partials.Channel, Partials.Message, Partials.User],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Debug logging for all Discord events
    this.client.on(Events.ClientReady, () => {
      logger.info(`Bot logged in as ${this.client.user?.tag}`);
      logger.info(`Bot is in ${this.client.guilds.cache.size} guilds`);
      this.client.guilds.cache.forEach(guild => {
        logger.info(`Guild: ${guild.name} (${guild.id})`);
        // Log guild channels
        guild.channels.cache.forEach(channel => {
          logger.info(`Channel in ${guild.name}: ${channel.name} (${channel.id})`);
        });
      });
    });

    this.client.on(Events.Error, error => {
      // Log the raw error first
      logger.error('Raw Discord error:', error);

      // Then log the formatted error
      if (error instanceof Error) {
        logger.error('Discord error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
          code: (error as any).code,
        });
      } else {
        logger.error('Unknown error type:', error);
      }
    });

    this.client.on(Events.Debug, info => {
      logger.debug(`Discord debug: ${info}`);
    });

    this.client.on(Events.Warn, info => {
      logger.warn('Discord warning:', info);
    });

    this.client.on(Events.InteractionCreate, async interaction => {
      logger.info('Received interaction:', {
        type: interaction.type,
        isCommand: interaction.isCommand(),
        commandName: interaction.isCommand() ? interaction.commandName : undefined,
        user: interaction.user.tag,
        guild: interaction.guild?.name,
        channel: interaction.channel?.id,
        options: interaction.isCommand() ? interaction.options.data : undefined,
        interactionId: interaction.id,
        applicationId: interaction.applicationId,
        token: interaction.token,
      });

      if (!interaction.isCommand()) {
        logger.debug('Received non-command interaction:', {
          type: interaction.type,
          user: interaction.user.tag,
        });
        return;
      }

      try {
        logger.info(`Processing command: ${interaction.commandName}`);

        // Add more detailed logging to help debug why charts command isn't recognized
        logger.info(`Command type: ${typeof interaction.commandName}`);
        logger.info(`Command handlers available:`, {
          killsHandler: typeof handleKillsCommand === 'function',
          mapHandler: typeof handleMapCommand === 'function',
          chartsHandler: typeof handleChartsCommand === 'function',
        });

        // Debug log all available commands
        logger.info(`Available commands in switch:`, ['kills', 'map', 'charts']);

        switch (interaction.commandName) {
          case 'kills':
            logger.info('Handling kills command');
            await handleKillsCommand(interaction);
            break;
          case 'map':
            logger.info('Handling map command');
            await handleMapCommand(interaction);
            break;
          case 'charts':
            logger.info('Handling charts command with validation');
            await handleValidatedChartsCommand(interaction);
            break;
          default:
            logger.warn(`Unknown command: ${interaction.commandName}`);
            await interaction.reply({
              content: 'Unknown command',
              flags: MessageFlags.Ephemeral,
            });
        }
      } catch (error) {
        logger.error('Error handling command:', {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  name: error.name,
                  stack: error.stack,
                }
              : error,
          commandName: interaction.commandName,
          user: interaction.user.tag,
        });
        const errorMessage = 'Sorry, there was an error processing your command.';

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: errorMessage,
              flags: MessageFlags.Ephemeral,
            });
          } else {
            await interaction.reply({
              content: errorMessage,
              flags: MessageFlags.Ephemeral,
            });
          }
        } catch (followupError) {
          logger.error('Error sending error response:', {
            error:
              followupError instanceof Error
                ? {
                    message: followupError.message,
                    name: followupError.name,
                    stack: followupError.stack,
                  }
                : followupError,
            commandName: interaction.commandName,
            user: interaction.user.tag,
          });
        }
      }
    });

    // Add logging for guild events
    this.client.on(Events.GuildCreate, guild => {
      logger.info(`Joined guild: ${guild.name} (${guild.id})`);
    });

    this.client.on(Events.GuildDelete, guild => {
      logger.info(`Left guild: ${guild.name} (${guild.id})`);
    });

    // Add logging for message events
    this.client.on(Events.MessageCreate, message => {
      // Only log messages that might be commands (starting with !) or are from bot mentions
      // Or are direct messages to the bot
      const isBotMentioned = message.mentions.users.has(this.client.user?.id ?? '');
      const isDirectMessage = !message.guild;
      const isPotentialCommand = message.content.startsWith('!');

      if (isBotMentioned || isDirectMessage || isPotentialCommand) {
        const truncatedContent =
          message.content.length > 100 ? `${message.content.substring(0, 100)}...` : message.content;

        logger.debug(
          `Discord message received: "${truncatedContent}" from ${
            message.author.tag
          } in ${message.guild?.name ?? 'DM'} (${message.channel.id})`
        );
      }
    });
  }

  async login(token: string) {
    try {
      logger.debug('Discord login attempt', {
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 10),
      });

      await this.client.login(token);
      logger.info('Successfully logged in to Discord');
    } catch (error) {
      logger.error('Failed to login to Discord', {
        errorType: typeof error,
        errorProperties: Object.getOwnPropertyNames(error),
        error:
          error instanceof Error
            ? {
                message: error.message,
                name: error.name,
                stack: error.stack,
                code: (error as any).code,
              }
            : error,
      });
      throw error;
    }
  }

  async registerCommands(commands: any[]) {
    try {
      // Wait for client to be ready before registering commands
      if (!this.client.isReady()) {
        logger.info('Waiting for client to be ready before registering commands');
        await new Promise<void>(resolve => {
          this.client.once(Events.ClientReady, () => resolve());
        });
      }

      const application = this.client.application;
      if (!application) {
        throw new Error('Application not available');
      }

      // Convert commands to JSON format
      const jsonCommands = commands.map(cmd => cmd.toJSON());
      logger.info(
        'Registering commands:',
        jsonCommands.map(cmd => cmd.name)
      );
      await application.commands.set(jsonCommands);
      logger.info('Successfully registered application commands');
    } catch (error) {
      logger.error('Failed to register commands:', {
        error:
          error instanceof Error
            ? {
                message: error.message,
                name: error.name,
                stack: error.stack,
              }
            : error,
      });
      throw error;
    }
  }

  // Helper methods to expose client state
  isReady(): boolean {
    return this.client.isReady();
  }

  getGuildsCount(): number {
    return this.client.guilds.cache.size;
  }
}
