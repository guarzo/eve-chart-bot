import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartOptions } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts';
import { errorHandler, ChartError, ValidationError } from '../../../../shared/errors';

/**
 * Handler for the /charts distribution command
 */
export class DistributionHandler extends BaseChartHandler {
  private chartRenderer: ChartRenderer;

  constructor() {
    super();
    this.chartRenderer = new ChartRenderer();
  }

  /**
   * Handle a distribution chart command
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const correlationId = errorHandler.createCorrelationId();
    
    try {
      await interaction.deferReply();

      // Extract options from the command
      const time = interaction.options.getString('time') ?? '7';
      const displayOption = interaction.options.getString('display') ?? 'pie';
      
      // Validate time parameter
      const timeValue = parseInt(time, 10);
      if (isNaN(timeValue) || timeValue <= 0 || timeValue > 365) {
        throw ValidationError.outOfRange(
          'time',
          1,
          365,
          time,
          {
            correlationId,
            userId: interaction.user.id,
            guildId: interaction.guildId || undefined,
            operation: 'distribution_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }

      // Get the time range
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating distribution chart for ${time} days with ${displayOption} display`, { correlationId });

      // Get all character groups
      const characterGroups = await this.characterRepository.getAllCharacterGroups();

      if (characterGroups.length === 0) {
        throw ChartError.noDataError(
          'distribution',
          'No character groups found',
          {
            correlationId,
            userId: interaction.user.id,
            guildId: interaction.guildId || undefined,
            operation: 'distribution_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }

      // Transform character groups into the format expected by the chart generator
      const transformedGroups = characterGroups.map(group => ({
        groupId: group.id,
        name: group.name,
        characters: group.characters.map(char => ({
          eveId: char.eveId,
          name: char.name,
        })),
        mainCharacterId: group.mainCharacterId,
      }));

      // Get the chart generator
      const generator = ChartFactory.createGenerator('distribution');

      // Generate the chart data with retry mechanism
      const chartData = await errorHandler.withRetry(
        () => generator.generateChart({
          startDate,
          endDate,
          characterGroups: transformedGroups,
          displayType: displayOption,
        }),
        2, // maxRetries
        1000, // baseDelay
        {
          operation: 'distribution_chart_generation',
          userId: interaction.user.id,
          guildId: interaction.guildId || undefined,
          correlationId,
          metadata: { interactionId: interaction.id, timeRange: time, displayType: displayOption },
        }
      );

      // Render the chart
      logger.info('Rendering distribution chart', { correlationId });
      const buffer = await this.chartRenderer.renderToBuffer(chartData, chartData.options as ChartOptions);

      // Send the chart image
      await interaction.editReply({
        content: chartData.summary,
        files: [{ attachment: buffer, name: 'distribution-chart.png' }],
      });
      
      logger.info('Successfully sent distribution chart', { correlationId });
    } catch (error: any) {
      logger.error('Error in distribution command handler', { 
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
