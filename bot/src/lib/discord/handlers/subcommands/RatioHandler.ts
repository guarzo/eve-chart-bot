import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartData } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts';
import { errorHandler, ChartError, ValidationError } from '../../../../shared/errors';

/**
 * Handler for the /charts ratio command
 */
export class RatioHandler extends BaseChartHandler {
  constructor() {
    super();
  }

  /**
   * Handle the kill-death ratio chart command
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
            operation: 'ratio_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }

      const { startDate, endDate } = this.getTimeRange(time);

      logger.info('Generating kill-death ratio chart', {
        correlationId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        timePeriod: time,
      });

      // Get character groups with error handling
      const groups = await this.getCharacterGroups();

      if (groups.length === 0) {
        throw ChartError.noDataError(
          'ratio',
          'No character groups found. Please add characters to groups first.',
          {
            correlationId,
            userId: interaction.user.id,
            guildId: interaction.guildId || undefined,
            operation: 'ratio_chart_generation',
          }
        );
      }

      // Get the chart generator from the factory
      const ratioGenerator = ChartFactory.createGenerator('ratio');

      // Generate chart data with retry logic
      const chartData = await errorHandler.withRetry(
        async () => {
          return await ratioGenerator.generateChart({
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
          operation: 'chart.generate.ratio',
          userId: interaction.user.id,
          metadata: {
            groupCount: groups.length,
            timePeriod: time,
          },
        }
      );

      // Render chart to buffer with error handling
      logger.info('Rendering ratio chart', { correlationId });
      const buffer = await this.renderChart(chartData, correlationId);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary ?? 'Kill/Death Ratio chart',
        files: [{ attachment: buffer, name: 'ratio-chart.png' }],
      });

      logger.info('Successfully sent kill-death ratio chart', {
        correlationId,
        bufferSize: buffer.length,
      });

    } catch (error) {
      // Enhanced error handling with correlation ID context
      const enhancedError = errorHandler.handleError(error, {
        correlationId,
        userId: interaction.user.id,
        guildId: interaction.guildId || undefined,
        operation: 'ratio_command',
        metadata: {
          interactionId: interaction.id,
          commandName: interaction.commandName,
          subcommand: 'ratio',
        },
      });

      await this.handleError(interaction, enhancedError);
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
          text: chartData.title ?? 'Kill/Loss Ratio by Character Group',
        },
        legend: {
          display: true,
          position: 'top' as const,
        },
      },
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: 'Ratio',
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Character',
          },
        },
      },
    };

    // Use a much larger canvas for better display in Discord without needing to click
    const renderer = new ChartRenderer(2200, 1400);
    return renderer.renderToBuffer(chartData, options);
  }
}
