import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartData, ChartOptions } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts';

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

    try {
      await interaction.deferReply();

      // Get time period from command options
      const time = interaction.options.getString('time') ?? '7';
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating heatmap chart for ${time} days`);

      // Get character groups
      const groups = await this.getCharacterGroups();

      if (groups.length === 0) {
        await interaction.editReply({
          content: 'No character groups found. Please add characters to groups first.',
        });
        return;
      }

      // Get the chart generator from the factory
      const heatmapGenerator = ChartFactory.createGenerator('heatmap');

      // Generate chart data
      const chartData = await heatmapGenerator.generateChart({
        characterGroups: groups,
        startDate,
        endDate,
        displayType: 'heatmap',
      });

      // Render chart to buffer
      logger.info('Rendering heatmap chart');
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary ?? 'Activity Heatmap',
        files: [{ attachment: buffer, name: 'heatmap-chart.png' }],
      });

      logger.info('Successfully sent heatmap chart');
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData): Promise<Buffer> {
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
    return renderer.renderToBuffer(chartData, options);
  }
}
