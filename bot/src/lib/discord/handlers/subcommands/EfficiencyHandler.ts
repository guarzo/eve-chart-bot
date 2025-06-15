import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartData, ChartOptions } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts';
import { errorHandler, ChartError, ValidationError } from '../../../errors';

/**
 * Handler for the /charts efficiency command
 * Shows efficiency metrics with gauge charts
 */
export class EfficiencyHandler extends BaseChartHandler {
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
            operation: 'efficiency_command',
            metadata: { interactionId: interaction.id },
          }
        );
      }

      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating efficiency chart for ${time} days`, {
        correlationId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        timePeriod: time,
      });

      // Get character groups with error handling
      const groups = await this.getCharacterGroups();

      if (groups.length === 0) {
        throw ChartError.noDataError(
          'efficiency',
          'No character groups found. Please add characters to groups first.',
          {
            correlationId,
            userId: interaction.user.id,
            guildId: interaction.guildId || undefined,
            operation: 'efficiency_chart_generation',
          }
        );
      }

      // Get the chart generator from the factory
      const efficiencyGenerator = ChartFactory.createGenerator('efficiency');

      // Generate chart data with retry logic
      const chartData = await errorHandler.withRetry(
        async () => {
          return await efficiencyGenerator.generateChart({
            characterGroups: groups,
            startDate,
            endDate,
            displayType: 'gauge',
          });
        },
        3,
        1000,
        {
          correlationId,
          operation: 'chart.generate.efficiency',
          userId: interaction.user.id,
          metadata: {
            groupCount: groups.length,
            timePeriod: time,
          },
        }
      );

      // Render chart to buffer
      logger.info('Rendering efficiency chart');
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary ?? 'Efficiency Chart',
        files: [{ attachment: buffer, name: 'efficiency-chart.png' }],
      });

      logger.info('Successfully sent efficiency chart');
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData): Promise<Buffer> {
    let options: ChartOptions;

    if (chartData.displayType === 'gauge') {
      // Options for a gauge/doughnut chart
      options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: chartData.title ?? 'Efficiency by Character Group',
            font: {
              size: 40,
              weight: 'bold',
            },
          },
          legend: {
            display: false, // Hide legend for gauge
            position: 'top' as const,
          },
        },
        rotation: -Math.PI,
        circumference: Math.PI,
        cutout: '70%',
      } as any; // Chart.js options for doughnut
    } else {
      // Bar chart options (existing)
      options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: chartData.title ?? 'Efficiency by Character Group',
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
            beginAtZero: true,
            suggestedMax: 100,
            title: {
              display: true,
              text: 'Efficiency (%)',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Character Group',
            },
          },
        },
      };
    }

    // Use a wide canvas for better display
    const renderer = new ChartRenderer(3000, 1600);
    return renderer.renderToBuffer(chartData, options);
  }
}
