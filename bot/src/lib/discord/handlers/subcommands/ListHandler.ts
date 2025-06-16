import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction, EmbedBuilder } from 'discord.js';
import { logger } from '../../../logger';
import { errorHandler } from '../../../../shared/errors';

/**
 * Handler for the /charts list command
 * Displays a list of all available chart types
 */
export class ListHandler extends BaseChartHandler {
  constructor() {
    super();
  }

  /**
   * Handle the list command interaction
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      logger.info('Handling list subcommand', { correlationId });

      // Define available subcommands directly to avoid circular dependency
      const subcommands = [
        'list',
        'kills',
        'map',
        'loss',
        'ratio',
        'shipkill',
        'shiploss',
        'distribution',
        'corps',
        'heatmap',
        'efficiency',
      ];

      // Map subcommands to friendly names/descriptions
      const chartDescriptions: Record<string, { name: string; value: string }> = {
        kills: {
          name: '📊 /charts kills [time]',
          value: 'Show kill activity by character group with stacked horizontal bars',
        },
        map: {
          name: '🗺️ /charts map [time]',
          value: 'Show map activity by character group with stacked horizontal bars',
        },
        loss: {
          name: '💥 /charts loss [time]',
          value: 'Show ship loss activity by character group',
        },
        ratio: {
          name: '📈 /charts ratio [time]',
          value: 'Show kill-death ratio by character group',
        },
        shipkill: {
          name: '🚀 /charts shipkill [time]',
          value: 'Show top ship types destroyed by your group(s) in the selected period.',
        },
        shiploss: {
          name: '💥 /charts shiploss [time]',
          value: 'Show top ship types lost by your group(s) in the selected period.',
        },
        distribution: {
          name: '🥧 /charts distribution [time]',
          value: 'Show pie chart of solo vs. group kills',
        },
        corps: {
          name: '🏢 /charts corps [time]',
          value: 'Show kills per enemy corporation',
        },
        heatmap: {
          name: '🌡️ /charts heatmap [time]',
          value: 'Show heatmap of kill activity by hour and day of week',
        },
        efficiency: {
          name: '📊 /charts efficiency [time]',
          value: 'Show efficiency metrics with gauge charts',
        },
      };

      // Build fields for the embed
      const fields = subcommands
        .filter(cmd => chartDescriptions[cmd] && cmd !== 'heatmap' && cmd !== 'trend' && cmd !== 'shiptypes')
        .map(cmd => chartDescriptions[cmd]);

      const embed = new EmbedBuilder()
        .setTitle('Available Chart Types')
        .setColor('#0099ff')
        .setDescription('Here are all the available chart types:')
        .addFields(fields)
        .setFooter({
          text: 'Use the specific command to generate that chart type',
        });

      await interaction.reply({ embeds: [embed] });
      logger.info('Successfully sent list of chart types', { correlationId });
    } catch (error) {
      logger.error('Error in list command handler', { 
        error, 
        correlationId, 
        userId: interaction.user.id,
        guildId: interaction.guildId || undefined,
        metadata: { interactionId: interaction.id }
      });
      await this.handleError(interaction, error);
    }
  }
}
