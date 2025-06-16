import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartData, ChartOptions } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts';
import { errorHandler, ChartError, ValidationError } from '../../../../shared/errors';

/**
 * Handler for the /charts trend command
 */
export class TrendHandler extends BaseChartHandler {
  constructor() {
    super();
  }

  /**
   * Handle the trend chart command
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
            operation: 'trend_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }

      // Check if view option is specified (line, area, or dual)
      const displayType = interaction.options.getString('view') ?? 'line';
      const validDisplayTypes = ['line', 'area', 'dual'];
      
      if (!validDisplayTypes.includes(displayType)) {
        throw ValidationError.invalidFormat(
          'view',
          'one of: line, area, dual',
          displayType,
          {
            correlationId,
            userId: interaction.user.id,
            guildId: interaction.guildId || undefined,
            operation: 'trend_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }

      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating trend chart for ${time} days with ${displayType} view`, {
        correlationId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        timePeriod: time,
        displayType,
      });

      // Get character groups with error handling
      const groups = await this.getCharacterGroups();

      if (groups.length === 0) {
        throw ChartError.noDataError(
          'trend',
          'No character groups found. Please add characters to groups first.',
          {
            correlationId,
            userId: interaction.user.id,
            guildId: interaction.guildId || undefined,
            operation: 'trend_chart_generation',
          }
        );
      }

      // Get the chart generator from the factory
      const trendGenerator = ChartFactory.createGenerator('trend');

      // Generate chart data with retry logic
      const chartData = await errorHandler.withRetry(
        async () => {
          return await trendGenerator.generateChart({
            characterGroups: groups,
            startDate,
            endDate,
            displayType: displayType,
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'chart.generate.trend',
          userId: interaction.user.id,
          metadata: {
            groupCount: groups.length,
            timePeriod: time,
            displayType,
          },
        }
      );

      // Render chart to buffer with error handling
      logger.info(`Rendering trend chart with ${displayType} view`, { correlationId });
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary ?? 'Trend Chart',
        files: [{ attachment: buffer, name: 'trend-chart.png' }],
      });

      logger.info('Successfully sent trend chart', {
        correlationId,
        displayType,
        bufferSize: buffer.length,
      });

    } catch (error) {
      // Enhanced error handling with correlation ID context
      const enhancedError = errorHandler.handleError(error, {
        correlationId,
        userId: interaction.user.id,
        guildId: interaction.guildId || undefined,
        operation: 'trend_command',
        metadata: {
          interactionId: interaction.id,
          commandName: interaction.commandName,
          subcommand: 'trend',
        },
      });

      await this.handleError(interaction, enhancedError);
    }
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData): Promise<Buffer> {
    // Create options object based on chartData.options or use defaults
    const options: ChartOptions =
      chartData.options ??
      ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: chartData.title ?? 'Kill Activity Over Time',
            font: {
              size: 40,
              weight: 'bold',
            },
          },
          legend: {
            display: true,
            position: 'top',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Kill Count',
            },
          },
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                hour: 'MMM d, HH:mm',
                day: 'MMM d',
                week: 'MMM d, yyyy',
                month: 'MMM yyyy',
              },
            },
            title: {
              display: true,
              text: 'Date',
            },
          },
        },
      } as ChartOptions); // Cast to ChartOptions to ensure type compatibility

    // For dual-axis charts, use wide format
    if (chartData.options?.scales?.y2) {
      return new ChartRenderer(3200, 1600).renderToBuffer(chartData, options);
    }

    // For area charts, use slightly taller format
    if (chartData.datasets.some(d => d.fill === true)) {
      return new ChartRenderer(3000, 1800).renderToBuffer(chartData, options);
    }

    // Default format for line charts
    return new ChartRenderer(3000, 1500).renderToBuffer(chartData, options);
  }
}
