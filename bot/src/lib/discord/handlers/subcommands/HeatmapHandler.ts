import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartData, ChartOptions } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts';
import { errorHandler, ChartError, ValidationError } from '../../../../shared/errors';

/**
 * Handler for the /charts heatmap command
 * Shows kill activity by hour and day of week
 */
export class HeatmapHandler extends BaseChartHandler {
  constructor() {
    super();
  }

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
            operation: 'heatmap_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }
      
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating heatmap chart for ${time} days`, { correlationId });

      // Get character groups
      const groups = await this.getCharacterGroups();

      if (groups.length === 0) {
        throw ChartError.noDataError(
          'heatmap',
          'No character groups found',
          {
            correlationId,
            userId: interaction.user.id,
            guildId: interaction.guildId || undefined,
            operation: 'heatmap_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }

      // Get the chart generator from the factory
      const heatmapGenerator = ChartFactory.createGenerator('heatmap');

      // Generate chart data with retry mechanism
      const chartData = await errorHandler.withRetry(
        () => heatmapGenerator.generateChart({
          characterGroups: groups,
          startDate,
          endDate,
          displayType: 'heatmap',
        }),
        2, // maxRetries
        1000, // baseDelay
        {
          operation: 'heatmap_chart_generation',
          userId: interaction.user.id,
          guildId: interaction.guildId || undefined,
          correlationId,
          metadata: { interactionId: interaction.id, timeRange: time },
        }
      );

      // Render chart to buffer
      logger.info('Rendering heatmap chart', { correlationId });
      const buffer = await this.renderChart(chartData, correlationId);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary ?? 'Activity Heatmap',
        files: [{ attachment: buffer, name: 'heatmap-chart.png' }],
      });

      logger.info('Successfully sent heatmap chart', { correlationId });
    } catch (error) {
      logger.error('Error in heatmap command handler', { 
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
    const options: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartData.title ?? 'Activity by Hour and Day',
          font: {
            size: 40,
            weight: 'bold',
          },
        },
        legend: {
          display: true,
          position: 'top' as const,
        },
      },
      scales: {
        x: {
          type: 'linear',
          suggestedMin: 0,
          suggestedMax: 23,
          title: {
            display: true,
            text: 'Hour of Day',
          },
        },
        y: {
          type: 'category',
          ticks: {
            callback: (value: any) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][value],
          },
          title: {
            display: true,
            text: 'Day of Week',
          },
        },
      },
    };

    // Use a square canvas for heatmap display
    const renderer = new ChartRenderer(2400, 2400);
    logger.debug('Rendering heatmap chart to buffer', { correlationId });
    return renderer.renderToBuffer(chartData, options);
  }
}
