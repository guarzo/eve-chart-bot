import { CommandInteraction } from 'discord.js';
import { ValidatedBaseChartHandler } from './ValidatedBaseChartHandler';
import { ChartData, ChartOptions } from '../../../../types/chart';
import { ChartRenderer } from '../../../../services/ChartRenderer';
import { logger } from '../../../logger';
import { ChartFactory } from '../../../../services/charts/ChartFactory';
import { theme } from '../../../../services/charts/config/theme';
import { CommandName, CommandSchema } from '../../validation/schemas';

/**
 * Validated handler for the /charts kills command
 */
export class ValidatedKillsHandler extends ValidatedBaseChartHandler {
  protected readonly commandName: CommandName = 'kills';

  constructor() {
    super();
  }

  /**
   * Handle the kills chart command with validated data
   */
  protected async handleValidated(
    interaction: CommandInteraction,
    validatedData: CommandSchema<'kills'>
  ): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply();

    // Use validated time parameter
    const { startDate, endDate } = this.getTimeRange(validatedData.time.toString());

    logger.info(
      `Generating kills chart for ${validatedData.time} days - Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Get character groups
    const groups = await this.getCharacterGroups();

    logger.info(`Found ${groups.length} character groups for chart generation`);

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

    // Render chart to buffer
    logger.info('Rendering kills chart');
    const buffer = await this.renderChart(chartData);

    // Send the chart with summary
    await interaction.editReply({
      content: chartData.summary ?? 'Kills chart',
      files: [{ attachment: buffer, name: 'kills-chart.png' }],
    });

    logger.info('Successfully sent kills chart');
  }

  /**
   * Render chart to buffer using appropriate options
   */
  private async renderChart(chartData: ChartData): Promise<Buffer> {
    const options: ChartOptions = {
      indexAxis: 'y', // Horizontal bar chart
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartData.title ?? 'Kills by Character Group',
          font: {
            size: 40,
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
