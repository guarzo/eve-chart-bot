import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartData, ChartOptions } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts';
import { errorHandler, ChartError, ValidationError } from '../../../../shared/errors';

/**
 * Handler for the /charts shiptypes command
 */
export class ShipTypesHandler extends BaseChartHandler {
  constructor() {
    super();
  }

  /**
   * Handle the ship types chart command
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
            operation: 'shiptypes_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }

      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating ship types chart for ${time} days`, {
        correlationId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        timePeriod: time,
      });

      // Get character groups with error handling
      const groups = await this.getCharacterGroups();

      if (groups.length === 0) {
        throw ChartError.noDataError(
          'shiptypes',
          'No character groups found. Please add characters to groups first.',
          {
            correlationId,
            userId: interaction.user.id,
            guildId: interaction.guildId || undefined,
            operation: 'shiptypes_chart_generation',
          }
        );
      }

      // Get the chart generator from the factory
      const shipTypesGenerator = ChartFactory.createGenerator('shiptypes');

      // Generate chart data with retry logic
      const chartData = await errorHandler.withRetry(
        async () => {
          return await shipTypesGenerator.generateChart({
            characterGroups: groups,
            startDate,
            endDate,
            displayType: 'horizontalBar', // horizontal bar is the default for ship types
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'chart.generate.shiptypes',
          userId: interaction.user.id,
          metadata: {
            groupCount: groups.length,
            timePeriod: time,
          },
        }
      );

      // Render chart to buffer with error handling
      logger.info('Rendering ship types chart', { correlationId });
      const buffer = await this.renderChart(chartData, correlationId);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary ?? 'Ship Types Chart',
        files: [{ attachment: buffer, name: 'shiptypes-chart.png' }],
      });

      logger.info('Successfully sent ship types chart', {
        correlationId,
        bufferSize: buffer.length,
      });

    } catch (error) {
      // Enhanced error handling with correlation ID context
      const enhancedError = errorHandler.handleError(error, {
        correlationId,
        userId: interaction.user.id,
        guildId: interaction.guildId || undefined,
        operation: 'shiptypes_command',
        metadata: {
          interactionId: interaction.id,
          commandName: interaction.commandName,
          subcommand: 'shiptypes',
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
    const options: ChartOptions = chartData.options ?? {
      indexAxis: 'y', // Horizontal bar chart by default
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartData.title ?? 'Ship Types Destroyed',
          font: {
            size: 40, // Extra large title
            weight: 'bold',
          },
        },
        legend: {
          display: false, // Don't need legend for single dataset
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: (context: any): string => {
              const label = context.dataset.label ?? '';
              const value = context.parsed.x;
              return `${label}: ${value.toLocaleString()} ships`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Count',
          },
          ticks: {
            callback: (value: any): string => {
              // Format numbers with K/M/B suffixes
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
              return value.toString();
            },
          },
        },
        y: {
          title: {
            display: true,
            text: 'Ship Type',
          },
        },
      },
    };

    // Use a wide canvas for horizontal bar chart display in Discord
    const renderer = new ChartRenderer(3200, 1280);

    // For line charts/timelines, use a different renderer size
    if (chartData.displayType === 'line') {
      return new ChartRenderer(2800, 1400).renderToBuffer(chartData, options);
    }

    return renderer.renderToBuffer(chartData, options);
  }
}
