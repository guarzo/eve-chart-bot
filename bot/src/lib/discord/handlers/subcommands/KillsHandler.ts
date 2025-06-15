import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartData, ChartOptions } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts/ChartFactory';
import { theme } from '../../../../services/charts/config/theme';
import { errorHandler, ChartError, ValidationError } from '../../../errors';

/**
 * Handler for the /charts kills command
 */
export class KillsHandler extends BaseChartHandler {
  constructor() {
    super();
  }

  /**
   * Handle the kills chart command
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
            operation: 'kills_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }

      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating kills chart for ${time} days`, {
        correlationId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        timePeriod: time,
        dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      });

      // Get character groups with error handling
      const groups = await this.getCharacterGroups();

      logger.info(`Found ${groups.length} character groups for chart generation`, {
        correlationId,
        groupCount: groups.length,
        firstFewGroups: groups.slice(0, 3).map(g => g.name),
      });

      // Log total character count across all groups
      const totalCharacters = groups.reduce((sum, group) => sum + group.characters.length, 0);
      logger.info(`Total character count across all groups: ${totalCharacters}`, {
        correlationId,
        totalCharacters,
      });

      if (groups.length === 0) {
        throw ChartError.noDataError(
          'kills',
          'No character groups found. Please add characters to groups first.',
          {
            correlationId,
            userId: interaction.user.id,
            guildId: interaction.guildId || undefined,
            operation: 'kills_chart_generation',
          }
        );
      }

      // Get the appropriate chart generator
      const generator = ChartFactory.createGenerator('kills');

      // Generate chart data with retry logic
      logger.info(`Generating chart data with ${groups.length} groups...`, { correlationId });
      
      const chartData = await errorHandler.withRetry(
        async () => {
          return await generator.generateChart({
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
          operation: 'chart.generate.kills',
          userId: interaction.user.id,
          metadata: {
            groupCount: groups.length,
            totalCharacters,
            timePeriod: time,
          },
        }
      );

      // Log chart results
      logger.info(`Chart data generated with ${chartData.labels?.length ?? 0} labels`, {
        correlationId,
        labelCount: chartData.labels?.length ?? 0,
        datasetCount: chartData.datasets?.length ?? 0,
      });

      if (chartData.datasets?.length > 0) {
        logger.info(`First dataset has ${chartData.datasets[0].data.length} data points`, {
          correlationId,
          firstDatasetLabel: chartData.datasets[0].label,
          dataPointCount: chartData.datasets[0].data.length,
        });
      }

      // Render chart to buffer with error handling
      logger.info('Rendering kills chart', { correlationId });
      const buffer = await this.renderChart(chartData, correlationId);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary ?? 'Kills chart',
        files: [{ attachment: buffer, name: 'kills-chart.png' }],
      });

      logger.info('Successfully sent kills chart', {
        correlationId,
        bufferSize: buffer.length,
      });

    } catch (error) {
      // Enhanced error handling with correlation ID context
      const enhancedError = errorHandler.handleError(error, {
        correlationId,
        userId: interaction.user.id,
        guildId: interaction.guildId || undefined,
        operation: 'kills_command',
        metadata: {
          interactionId: interaction.id,
          commandName: interaction.commandName,
          subcommand: 'kills',
        },
      });

      await this.handleError(interaction, enhancedError);
    }
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData, correlationId?: string): Promise<Buffer> {
    // Create a simpler options object that conforms to the ChartOptions interface
    const options: ChartOptions = {
      indexAxis: 'y', // Horizontal bar chart
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartData.title ?? 'Kills by Character Group',
          font: {
            size: 40, // Extra large title
            weight: 'bold',
          },
        },
        legend: {
          position: 'top',
          labels: {
            color: theme.text.primary,
            font: {
              size: 12,
            },
          },
        },
        tooltip: {
          backgroundColor: theme.colors.background,
          titleColor: theme.text.primary,
          bodyColor: theme.text.primary,
          borderColor: theme.colors.primary,
          borderWidth: 1,
          padding: 10,
          displayColors: true,
          callbacks: {
            label: context => {
              const label = context.dataset.label ?? '';
              const parsed = context.parsed as { x?: number; y?: number } | number;
              const value = typeof parsed === 'object' ? (parsed.x ?? parsed.y ?? 0) : parsed;
              return `${label}: ${value}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: theme.grid.color,
          },
          ticks: {
            color: theme.text.primary,
            font: {
              size: 12,
            },
          },
        },
        y: {
          grid: {
            color: theme.grid.color,
          },
          ticks: {
            color: theme.text.primary,
            font: {
              size: 12,
            },
          },
        },
      },
    };

    // Use a very wide canvas for horizontal bar chart display in Discord
    const renderer = new ChartRenderer(3200, 1280);

    // Set the data point styling
    if (chartData.datasets.length >= 2) {
      // Set distinct colors for total kills vs solo kills
      // Use solid colors for better visibility in Discord
      if (chartData.datasets[0].label === 'Total Kills') {
        chartData.datasets[0].backgroundColor = '#3366CC'; // Blue for total kills
      }

      if (chartData.datasets[1].label === 'Solo Kills') {
        chartData.datasets[1].backgroundColor = '#DC3912'; // Red for solo kills
      }

      // Add borders for better definition
      chartData.datasets[0].borderColor = '#1A478F'; // Darker blue border
      chartData.datasets[1].borderColor = '#8F1A1A'; // Darker red border

      // Log the solo kill values
      logger.debug('Solo kills dataset', {
        data: chartData.datasets[1].data,
      });
    }

    // Pass additional styling options to the renderer with error handling
    try {
      return await errorHandler.withRetry(
        async () => {
          return await renderer.renderToBuffer(chartData, options);
        },
        2,
        1000,
        {
          correlationId,
          operation: 'chart.render.kills',
          metadata: {
            chartType: 'kills',
            labelCount: chartData.labels?.length ?? 0,
            datasetCount: chartData.datasets?.length ?? 0,
          },
        }
      );
    } catch (error) {
      throw errorHandler.handleChartError(
        error,
        'kills',
        chartData.datasets?.map(d => d.label || 'unknown'),
        chartData.labels?.length,
        {
          correlationId,
          operation: 'chart.render.kills',
          metadata: {
            renderingEngine: 'chart.js',
            canvasSize: '3200x1280',
          },
        }
      );
    }
  }
}
