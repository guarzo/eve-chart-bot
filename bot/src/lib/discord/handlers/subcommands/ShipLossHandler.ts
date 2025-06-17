import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartData, ChartOptions } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts';
import { Scale } from 'chart.js';

/**
 * Handler for the /charts shiploss command
 */
export class ShipLossHandler extends BaseChartHandler {
  constructor() {
    super();
  }

  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply();

      // Get time period from command options
      const time = interaction.options.getString('time') ?? '7';
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating ship loss chart for ${time} days`);

      // Get character groups
      const groups = await this.getCharacterGroups();

      if (groups.length === 0) {
        await interaction.editReply({
          content: 'No character groups found. Please add characters to groups first.',
        });
        return;
      }

      // Get the chart generator from the factory
      const shipLossGenerator = ChartFactory.createGenerator('shiploss');

      // Generate chart data
      const chartData = await shipLossGenerator.generateChart({
        characterGroups: groups,
        startDate,
        endDate,
        displayType: 'horizontalBar',
      });

      // Render chart to buffer
      logger.info('Rendering ship loss chart');
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary ?? 'Ship Loss Chart',
        files: [{ attachment: buffer, name: 'shiploss-chart.png' }],
      });

      logger.info('Successfully sent ship loss chart');
    } catch (error) {
      logger.error('Error generating ship loss chart:', error);
      await this.handleError(interaction, error);
    }
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData): Promise<Buffer> {
    const options: ChartOptions = {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartData.title ?? 'Ships Lost by Type',
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
            label: (context: any) => {
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
            text: 'Count',
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
            text: 'Ship Type',
            font: {
              size: 20,
            },
          },
        },
      },
    };

    // Use a wide canvas for better display
    const renderer = new ChartRenderer(3000, 1600);
    return renderer.renderToBuffer(chartData, options);
  }
}
