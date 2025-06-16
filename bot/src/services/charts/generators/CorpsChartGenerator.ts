import { BaseChartGenerator } from '../BaseChartGenerator';
import { ChartData } from '../../../types/chart';
import { CorpsChartConfig } from '../config/CorpsChartConfig';
// import { KillRepository } from '../../../infrastructure/repositories/KillRepository';
import { format } from 'date-fns';
import { logger } from '../../../lib/logger';
import axios from 'axios';
import { RepositoryManager } from '../../../infrastructure/repositories/RepositoryManager';

/**
 * Generator for enemy corporation charts
 */
export class CorpsChartGenerator extends BaseChartGenerator {
  // private _killRepository: KillRepository;
  // Helper to fetch corp ticker from ESI and cache it
  private corpTickerCache: Record<string, string> = {};

  /**
   * Create a new corps chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    // this._killRepository = this.repoManager.getKillRepository();
  }

  /**
   * Generate an enemy corporation chart based on the provided options
   */
  async generateChart(options: {
    startDate: Date;
    endDate: Date;
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>;
    displayType: string;
  }): Promise<ChartData> {
    try {
      const { startDate, endDate, characterGroups, displayType } = options;
      logger.info(`Generating enemy corps chart from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      logger.debug(`Chart type: ${displayType}, Groups: ${characterGroups.length}`);

      // Select chart generation function based on display type
      if (displayType === 'verticalBar') {
        return this.generateVerticalBarChart(characterGroups, startDate, endDate);
      } else if (displayType === 'pie') {
        return this.generatePieChart(characterGroups, startDate, endDate);
      } else {
        // Default to horizontal bar chart
        return this.generateHorizontalBarChart(characterGroups, startDate, endDate);
      }
    } catch (error) {
      logger.error('Error generating enemy corps chart:', error);
      throw error;
    }
  }

  // Helper to fetch corp ticker from ESI and cache it
  private async getCorpTicker(corpId: string): Promise<string> {
    if (this.corpTickerCache[corpId]) return this.corpTickerCache[corpId];
    try {
      const resp = await axios.get(`https://esi.evetech.net/latest/corporations/${corpId}/?datasource=tranquility`);
      const ticker = resp.data.ticker || corpId;
      this.corpTickerCache[corpId] = ticker;
      return ticker;
    } catch {
      return corpId;
    }
  }

  /**
   * Generate a horizontal bar chart showing top enemy corporations
   */
  private async generateHorizontalBarChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Extract all character IDs from the groups
    const characterIds = characterGroups.flatMap(group => group.characters).map(character => BigInt(character.eveId));

    if (characterIds.length === 0) {
      throw new Error('No characters found in the provided groups');
    }

    // TODO: getTopEnemyCorporations method needs to be implemented in KillRepository
    // For now, return empty data to prevent compilation errors
    const corpsData: Array<{ corpId: string; killCount: number }> = [];
    
    // Placeholder warning
    console.warn('getTopEnemyCorporations not implemented - returning empty data');

    if (corpsData.length === 0) {
      throw new Error('No enemy corporation data found for the specified time period');
    }

    // Lookup tickers for all corpIds
    const labelTickers = await Promise.all(corpsData.map((corp: { corpId: string; killCount: number }) => this.getCorpTicker(corp.corpId)));

    // Sort by kill count in descending order
    corpsData.sort((a: { killCount: number }, b: { killCount: number }) => b.killCount - a.killCount);

    // Calculate total kills
    const totalKills = corpsData.reduce((sum: number, corp: { killCount: number }) => sum + corp.killCount, 0);

    // Get top corporation information for summary
    const topCorp = corpsData[0];
    const topCorpTicker = labelTickers[0];

    // Create chart data
    const chartData: ChartData = {
      labels: labelTickers,
      datasets: [
        {
          label: 'Kills',
          data: corpsData.map((corp: { killCount: number }) => corp.killCount),
          backgroundColor: corpsData.map((_: any, i: number) => CorpsChartConfig.colors[i % CorpsChartConfig.colors.length]),
          borderColor: corpsData.map((_: any, i: number) =>
            this.adjustColorBrightness(CorpsChartConfig.colors[i % CorpsChartConfig.colors.length], -20)
          ),
        },
      ],
      displayType: 'bar',
      options: {
        indexAxis: 'y',
      },
      title: `${CorpsChartConfig.title} - ${format(startDate, 'MMM d')} to ${format(endDate, 'MMM d, yyyy')}`,
      summary: CorpsChartConfig.getDefaultSummary(corpsData.length, totalKills, topCorpTicker, topCorp.killCount),
    };

    return chartData;
  }

  /**
   * Generate a vertical bar chart showing top enemy corporations
   */
  private async generateVerticalBarChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // This is similar to horizontal bar chart but with a different orientation
    const chartData = await this.generateHorizontalBarChart(characterGroups, startDate, endDate);

    // Override options for vertical orientation
    chartData.options = CorpsChartConfig.verticalBarOptions;
    chartData.displayType = 'bar';
    return chartData;
  }

  /**
   * Generate a pie chart showing distribution of kills among top enemy corporations
   */
  private async generatePieChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Extract all character IDs from the groups
    const characterIds = characterGroups.flatMap(group => group.characters).map(character => BigInt(character.eveId));

    if (characterIds.length === 0) {
      throw new Error('No characters found in the provided groups');
    }

    // TODO: getTopEnemyCorporations method needs to be implemented in KillRepository
    // For now, return empty data to prevent compilation errors
    const corpsData: Array<{ corpId: string; killCount: number }> = [];
    
    // Placeholder warning
    console.warn('getTopEnemyCorporations not implemented - returning empty data');

    if (corpsData.length === 0) {
      throw new Error('No enemy corporation data found for the specified time period');
    }

    // Sort by kill count in descending order
    corpsData.sort((a: { killCount: number }, b: { killCount: number }) => b.killCount - a.killCount);

    // Calculate total kills for the top corporations
    const totalTopCorpsKills = corpsData.reduce((sum: number, corp: { killCount: number }) => sum + corp.killCount, 0);

    // Get total kills for all corporations to calculate "Others" category
    // Note: This is currently a placeholder implementation
    // TODO: getTopEnemyCorporations needs to be implemented

    // Since this is a placeholder, use the top corps total as the total for now
    const totalAllCorpsKills = totalTopCorpsKills;

    // Calculate "Others" if there's a significant difference
    const otherCorpsKills = totalAllCorpsKills - totalTopCorpsKills;

    // Only add "Others" category if it's more than 1% of total kills
    const othersThreshold = totalAllCorpsKills * 0.01;

    // Copy the data and add "Others" if needed
    const pieLabels = corpsData.map((corp) => corp.corpId);
    const pieData = corpsData.map((corp: { killCount: number }) => corp.killCount);
    const pieColors = corpsData.map((_: any, i: number) => CorpsChartConfig.colors[i % CorpsChartConfig.colors.length]);

    if (otherCorpsKills > othersThreshold) {
      pieLabels.push('Others');
      pieData.push(otherCorpsKills);
      pieColors.push('#999999'); // Gray for "Others"
    }

    // Get top corporation information for summary
    const topCorp = corpsData[0];

    // Create chart data
    const chartData: ChartData = {
      labels: pieLabels,
      datasets: [
        {
          label: 'Kills',
          data: pieData,
          backgroundColor: pieColors,
          borderColor: pieColors.map((color: string) => this.adjustColorBrightness(color, -20)),
        },
      ],
      displayType: 'pie',
      title: `Kill Distribution by Enemy Corporation - ${format(
        startDate,
        'MMM d'
      )} to ${format(endDate, 'MMM d, yyyy')}`,
      options: CorpsChartConfig.pieOptions,
      summary: CorpsChartConfig.getDefaultSummary(
        corpsData.length,
        totalAllCorpsKills,
        topCorp.corpId,
        topCorp.killCount
      ),
    };

    return chartData;
  }
}
