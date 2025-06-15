import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartData } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { TooltipItem, Scale } from 'chart.js';
import { ChartFactory } from '../../../../services/charts';
import { errorHandler, ChartError, ValidationError } from '../../../../shared/errors';

/**
 * Handler for the /charts loss command
 */
export class LossHandler extends BaseChartHandler {
  constructor() {
    super();
  }

  /**
   * Handle the ship loss chart command
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
            operation: 'loss_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }

      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating loss chart for ${time} days`, {
        correlationId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        timePeriod: time,
      });

      // Get character groups with error handling
      const groups = await this.getCharacterGroups();

      if (groups.length === 0) {
        throw ChartError.noDataError(
          'loss',
          'No character groups found. Please add characters to groups first.',
          {
            correlationId,
            userId: interaction.user.id,
            guildId: interaction.guildId || undefined,
            operation: 'loss_chart_generation',
          }
        );
      }

      // Get the chart generator from the factory
      const lossGenerator = ChartFactory.createGenerator('loss');

      // Generate chart data with retry logic
      const chartData = await errorHandler.withRetry(
        async () => {
          return await lossGenerator.generateChart({
            characterGroups: groups,
            startDate,
            endDate,
            displayType: 'horizontalBar',
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'chart.generate.loss',
          userId: interaction.user.id,
          metadata: {
            groupCount: groups.length,
            timePeriod: time,
          },
        }
      );

      // Render chart to buffer
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary ?? 'Loss chart',
        files: [{ attachment: buffer, name: 'loss-chart.png' }],
      });

      logger.info('Successfully sent loss chart');
    } catch (error) {
      logger.error('Error generating loss chart:', error);
      await this.handleError(interaction, error);
    }
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData): Promise<Buffer> {
    const options = {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartData.title ?? 'Losses by Character Group',
          font: {
            size: 40,
            weight: 'bold',
          },
        },
        legend: {
          display: true,
          position: 'top' as const,
        },
        tooltip: {
          callbacks: {
            label: (context: TooltipItem<'bar'>) => {
              const label = context.dataset.label ?? '';
              const value = context.parsed.y;
              if (label.includes('ISK')) {
                return `${label}: ${value.toLocaleString()} B`;
              }
              return `${label}: ${value.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: 'ISK Lost',
            font: {
              size: 20,
            },
          },
          ticks: {
            callback: function (this: Scale, value: string | number) {
              if (typeof value === 'number') {
                return value.toLocaleString();
              }
              return value;
            },
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Character',
            font: {
              size: 20,
            },
          },
        },
      },
    };

    // Use a much larger canvas for better display in Discord without needing to click
    const renderer = new ChartRenderer(2200, 1400);
    return renderer.renderToBuffer(chartData, options);
  }
}
