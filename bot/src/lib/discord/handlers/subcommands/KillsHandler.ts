import { BaseChartHandler } from './BaseChartHandler';
import { CommandInteraction } from 'discord.js';
import { ChartData, ChartOptions } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts/ChartFactory';
import { theme } from '../../../../services/charts/config/theme';

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

    try {
      await interaction.deferReply();

      // Get time period from command options
      const time = interaction.options.getString('time') ?? '7';
      const { startDate, endDate } = this.getTimeRange(time);

      logger.info(
        `Generating kills chart for ${time} days - Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      // Get character groups
      const groups = await this.getCharacterGroups();

      logger.info(`Found ${groups.length} character groups for chart generation`);
      logger.info(
        `First few groups: ${groups
          .slice(0, 3)
          .map(g => g.name)
          .join(', ')}${groups.length > 3 ? '...' : ''}`
      );

      // Log total character count across all groups
      const totalCharacters = groups.reduce((sum, group) => sum + group.characters.length, 0);
      logger.info(`Total character count across all groups: ${totalCharacters}`);

      if (groups.length === 0) {
        await interaction.editReply({
          content: 'No character groups found. Please add characters to groups first.',
        });
        return;
      }

      // Get the appropriate chart generator
      const generator = ChartFactory.createGenerator('kills');

      // Generate chart data
      logger.info(`Generating chart data with ${groups.length} groups...`);
      const chartData = await generator.generateChart({
        characterGroups: groups,
        startDate,
        endDate,
        displayType: 'horizontalBar',
      });

      // Log chart results
      logger.info(`Chart data generated with ${chartData.labels?.length ?? 0} labels`);
      if (chartData.datasets?.length > 0) {
        logger.info(
          `First dataset (${chartData.datasets[0].label}) has ${chartData.datasets[0].data.length} data points`
        );
      }

      // Render chart to buffer
      logger.info('Rendering kills chart');
      const buffer = await this.renderChart(chartData);

      // Send the chart with summary - make sure not to return this value
      await interaction.editReply({
        content: chartData.summary ?? 'Kills chart',
        files: [{ attachment: buffer, name: 'kills-chart.png' }],
      });

      logger.info('Successfully sent kills chart');
    } catch (error) {
      await this.handleError(interaction, error);
    }
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData): Promise<Buffer> {
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

    // Pass additional styling options to the renderer
    return renderer.renderToBuffer(chartData, options);
  }
}
