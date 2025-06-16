import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartData, ChartOptions } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts';
import { errorHandler, ChartError, ValidationError } from '../../../../shared/errors';

/**
 * Handler for the /charts corps command
 */
export class CorpsHandler extends BaseChartHandler {
  constructor() {
    super();
  }

  /**
   * Handle the corps chart command
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const correlationId = errorHandler.createCorrelationId();
    
    try {
      await interaction.deferReply();

      // Get time period from command options
      const time = interaction.options.getString('time') ?? '7';
      
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
            operation: 'corps_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }
      
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating enemy corporations chart for ${time} days`, { correlationId });

      // Get character groups
      const groups = await this.getCharacterGroups();

      if (groups.length === 0) {
        throw ChartError.noDataError(
          'corps',
          'No character groups found',
          {
            correlationId,
            userId: interaction.user.id,
            guildId: interaction.guildId || undefined,
            operation: 'corps_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }

      // Get the chart generator from the factory
      const corpsGenerator = ChartFactory.createGenerator('corps');

      // Check if view option is specified (horizontalBar, verticalBar, or pie)
      const displayType = interaction.options.getString('view') ?? 'horizontalBar';

      // Generate chart data with retry mechanism
      const chartData = await errorHandler.withRetry(
        () => corpsGenerator.generateChart({
          characterGroups: groups,
          startDate,
          endDate,
          displayType: displayType,
        }),
        2, // maxRetries
        1000, // baseDelay
        {
          operation: 'corps_chart_generation',
          userId: interaction.user.id,
          guildId: interaction.guildId || undefined,
          correlationId,
          metadata: { interactionId: interaction.id, timeRange: time, displayType },
        }
      );

      // Render chart to buffer
      logger.info(`Rendering enemy corporations chart with ${displayType} view`, { correlationId });
      const buffer = await this.renderChart(chartData, correlationId);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary ?? 'Enemy Corporations Chart',
        files: [{ attachment: buffer, name: 'corps-chart.png' }],
      });

      logger.info('Successfully sent enemy corporations chart', { correlationId });
    } catch (error) {
      logger.error('Error in corps command handler', { 
        error, 
        correlationId, 
        userId: interaction.user.id,
        guildId: interaction.guildId || undefined,
        metadata: { interactionId: interaction.id }
      });
      await this.handleError(interaction, error);
    }
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData, correlationId?: string): Promise<Buffer> {
    // Create options object based on chartData.options or use defaults
    const options: ChartOptions = chartData.options ?? {
      responsive: true,
      maintainAspectRatio: false,
    };

    logger.debug('Rendering corps chart to buffer', { correlationId, displayType: chartData.displayType });
    
    // Use different canvas sizes based on chart type
    if (chartData.displayType === 'pie') {
      return new ChartRenderer(2400, 2400).renderToBuffer(chartData, options);
    } else if (chartData.displayType === 'bar') {
      // Vertical bar chart
      return new ChartRenderer(3000, 1800).renderToBuffer(chartData, options);
    } else {
      // Horizontal bar chart (default)
      return new ChartRenderer(3200, 1600).renderToBuffer(chartData, options);
    }
  }
}
