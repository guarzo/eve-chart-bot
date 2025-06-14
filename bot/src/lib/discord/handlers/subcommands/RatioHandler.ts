import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartData } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts';

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

    try {
      await interaction.deferReply();

      // Get time period from command options
      const time = interaction.options.getString('time') ?? '7';
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(`Generating kill-death ratio chart for ${time} days`);

      // Get character groups
      const groups = await this.getCharacterGroups();

      if (groups.length === 0) {
        await interaction.editReply({
          content: 'No character groups found. Please add characters to groups first.',
        });
        return;
      }

      // Get the chart generator from the factory
      const ratioGenerator = ChartFactory.createGenerator('ratio');

      // Generate chart data
      const chartData = await ratioGenerator.generateChart({
        characterGroups: groups,
        startDate,
        endDate,
        displayType: 'horizontalBar',
      });

      // Render chart to buffer
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary
      await interaction.editReply({
        content: chartData.summary ?? 'Kill/Death Ratio chart',
        files: [{ attachment: buffer, name: 'ratio-chart.png' }],
      });

      logger.info('Successfully sent kill-death ratio chart');
    } catch (error) {
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
