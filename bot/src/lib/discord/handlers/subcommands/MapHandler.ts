import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartData } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts';
import { errorHandler, ChartError, ValidationError } from '../../../errors';

/**
 * Handler for the /charts map command
 */
export class MapHandler extends BaseChartHandler {
  constructor() {
    super();
  }

  /**
   * Handle the map activity chart command
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const correlationId = errorHandler.createCorrelationId();
    const startTime = Date.now();

    try {
      logger.info('Starting map activity chart generation', {
        correlationId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        interactionId: interaction.id,
      });

      await interaction.deferReply();
      logger.info(`Deferred reply after ${Date.now() - startTime}ms`, { correlationId });

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
            operation: 'map_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }

      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating map activity chart for ${time} days`, {
        correlationId,
        timePeriod: time,
        dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      });

      // Get character groups with timing
      logger.info('Fetching character groups...', { correlationId });
      const groupsStartTime = Date.now();
      const groups = await this.getCharacterGroups();
      logger.info(`Got ${groups.length} character groups after ${Date.now() - groupsStartTime}ms`, {
        correlationId,
        groupCount: groups.length,
        fetchTime: Date.now() - groupsStartTime,
      });

      if (groups.length === 0) {
        throw ChartError.noDataError(
          'map',
          'No character groups found. Please add characters to groups first.',
          {
            correlationId,
            userId: interaction.user.id,
            guildId: interaction.guildId || undefined,
            operation: 'map_chart_generation',
          }
        );
      }

      // Get the chart generator from the factory
      logger.info('Creating chart generator...');
      const mapGenerator = ChartFactory.createGenerator('map');

      // Generate chart data
      logger.info('Generating chart data...');
      const chartStartTime = Date.now();
      const chartData = await mapGenerator.generateChart({
        characterGroups: groups,
        startDate,
        endDate,
        displayType: 'horizontalBar',
      });
      logger.info(`Chart data generated after ${Date.now() - chartStartTime}ms`);

      // Render chart to buffer
      logger.info('Rendering map activity chart');
      const renderStartTime = Date.now();
      const buffer = await this.renderChart(chartData);
      logger.info(`Chart rendered after ${Date.now() - renderStartTime}ms`);

      // Send the chart with summary
      logger.info('Sending chart response...');
      const responseStartTime = Date.now();
      await interaction.editReply({
        content: chartData.summary ?? 'Map activity chart',
        files: [{ attachment: buffer, name: 'map-chart.png' }],
      });
      logger.info(`Response sent after ${Date.now() - responseStartTime}ms`);

      logger.info(`Successfully sent map activity chart - total time: ${Date.now() - startTime}ms`);
    } catch (error) {
      logger.error(`Error after ${Date.now() - startTime}ms:`, error);
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
          text: chartData.title ?? 'Map Activity by Character Group',
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
            text: 'Count',
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
