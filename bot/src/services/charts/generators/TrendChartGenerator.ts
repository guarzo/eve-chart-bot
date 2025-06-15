/* eslint-disable max-lines */
import { BaseChartGenerator } from '../BaseChartGenerator';
import { ChartData } from '../../../types/chart';
import { TrendChartConfig } from '../config';
import { KillRepository } from '../../../infrastructure/repositories/KillRepository';
import { format } from 'date-fns';
import { logger } from '../../../lib/logger';
import { RepositoryManager } from '../../../infrastructure/repositories/RepositoryManager';
import { errorHandler, ChartError, ValidationError } from '../../../lib/errors';

/**
 * Generator for trend charts showing kills over time
 */
export class TrendChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;

  /**
   * Create a new trend chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    this.killRepository = this.repoManager.getKillRepository();
  }

  /**
   * Generate a trend chart based on the provided options
   */
  override async generateChart(options: {
    startDate: Date;
    endDate: Date;
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>;
    displayType: string;
  }): Promise<ChartData> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      const { startDate, endDate, characterGroups, displayType } = options;

      // Input validation
      this.validateChartOptions(options, correlationId);

      logger.info(`Generating trend chart from ${startDate.toISOString()} to ${endDate.toISOString()}`, { correlationId });
      logger.debug(`Chart type: ${displayType}, Groups: ${characterGroups.length}`, { correlationId });

      // Select chart generation function based on display type
      if (displayType === 'area') {
        return this.generateAreaChart(characterGroups, startDate, endDate, correlationId);
      } else if (displayType === 'dual') {
        return this.generateDualAxisChart(characterGroups, startDate, endDate, correlationId);
      } else {
        // Default to line chart (timeline)
        return this.generateTimelineChart(characterGroups, startDate, endDate, correlationId);
      }
    } catch (error) {
      logger.error('Error generating trend chart', { 
        error, 
        correlationId,
        context: { 
          operation: 'generateTrendChart',
          hasOptions: !!options,
          displayType: options?.displayType,
          characterGroupCount: options?.characterGroups?.length || 0
        }
      });

      if (error instanceof ChartError || error instanceof ValidationError) {
        throw error;
      }

      throw new ChartError('CHART_GENERATION_FAILED', 'Failed to generate trend chart', {
        cause: error,
        context: { correlationId, operation: 'generateTrendChart' }
      });
    }
  }

  /**
   * Generate a timeline chart showing kills over time
   */
  private async generateTimelineChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date,
    correlationId: string
  ): Promise<ChartData> {
    // First, determine the appropriate time grouping based on date range
    const dateRange = endDate.getTime() - startDate.getTime();
    const days = dateRange / (1000 * 60 * 60 * 24);

    let groupBy: 'hour' | 'day' | 'week' = 'day';
    if (days <= 2) {
      groupBy = 'hour';
    } else if (days > 30) {
      groupBy = 'week';
    }

    // Create a dataset for each character group
    const datasets = [];
    const timeLabels = new Set<string>();
    let overallTotalKills = 0;
    const allDataPoints: number[] = []; // Used for trend calculation

    // Process each group
    for (let i = 0; i < characterGroups.length; i++) {
      const group = characterGroups[i];

      // Get all character IDs for this group
      const characterIds = group.characters.map(char => BigInt(char.eveId));

      if (characterIds.length === 0) {
        continue;
      }

      // Get kill data grouped by time with retry logic
      const killData = await errorHandler.withRetry(
        () => this.killRepository.getKillsGroupedByTime(characterIds, startDate, endDate, groupBy),
        {
          retries: 3,
          context: { operation: 'fetchKillData', groupBy, correlationId }
        }
      );

      // Skip if no data
      if (killData.length === 0) {
        logger.debug(`No kill data found for group ${group.name}`, { correlationId });
        continue;
      }

      // Determine proper display name for the group
      let displayName = group.name;

      // Try to find the main character or use the first character
      if (group.characters.length > 0) {
        const mainCharacter = group.characters.find(char =>
          group.characters.some(c => c.eveId !== char.eveId && c.name.includes(char.name.split(' ')[0]))
        );

        if (mainCharacter) {
          displayName = mainCharacter.name;
        } else {
          displayName = group.characters[0].name;
        }
      }

      // Extract the data points and collect labels
      const dataPoints: number[] = [];
      const timePoints: string[] = [];

      let groupTotalKills = 0;

      for (const point of killData) {
        const formattedTime = format(point.timestamp, this.getDateFormat(groupBy));
        timePoints.push(formattedTime);
        timeLabels.add(formattedTime);

        dataPoints.push(point.kills);
        groupTotalKills += point.kills;
        allDataPoints.push(point.kills); // For trend calculation
      }

      // Update overall statistics
      overallTotalKills += groupTotalKills;

      // Add dataset for this group
      datasets.push({
        label: displayName,
        data: dataPoints,
        backgroundColor: TrendChartConfig.colors[i % TrendChartConfig.colors.length],
        borderColor: TrendChartConfig.colors[i % TrendChartConfig.colors.length],
        fill: false,
      });
    }

    // Sort the time labels chronologically
    const sortedLabels = Array.from(timeLabels).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });

    // Calculate average kills per day
    const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const averageKillsPerDay = overallTotalKills / dayCount;

    // Calculate the trend (increasing, stable, or decreasing)
    const trend = this.calculateTrend(allDataPoints);

    // Create chart data
    const chartData: ChartData = {
      labels: sortedLabels,
      datasets,
      displayType: 'line',
      title: `${TrendChartConfig.title} - ${format(startDate, 'MMM d')} to ${format(endDate, 'MMM d, yyyy')}`,
      options: TrendChartConfig.timelineOptions,
      summary: TrendChartConfig.getDefaultSummary(overallTotalKills, averageKillsPerDay, trend),
    };

    return chartData;
  }

  /**
   * Generate an area chart showing cumulative kills over time
   */
  private async generateAreaChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date,
    correlationId: string
  ): Promise<ChartData> {
    // First, determine the appropriate time grouping based on date range
    const dateRange = endDate.getTime() - startDate.getTime();
    const days = dateRange / (1000 * 60 * 60 * 24);

    let groupBy: 'hour' | 'day' | 'week' = 'day';
    if (days <= 2) {
      groupBy = 'hour';
    } else if (days > 30) {
      groupBy = 'week';
    }

    // Create a dataset for each character group
    const datasets = [];
    const timeLabels = new Set<string>();
    let overallTotalKills = 0;
    const allDataPoints: number[] = []; // Used for trend calculation

    // Process each group
    for (let i = 0; i < characterGroups.length; i++) {
      const group = characterGroups[i];

      // Get all character IDs for this group
      const characterIds = group.characters.map(char => BigInt(char.eveId));

      if (characterIds.length === 0) {
        continue;
      }

      // Get kill data grouped by time with retry logic
      const killData = await errorHandler.withRetry(
        () => this.killRepository.getKillsGroupedByTime(characterIds, startDate, endDate, groupBy),
        {
          retries: 3,
          context: { operation: 'fetchKillData', groupBy, correlationId }
        }
      );

      // Skip if no data
      if (killData.length === 0) {
        logger.debug(`No kill data found for group ${group.name}`, { correlationId });
        continue;
      }

      // Determine proper display name for the group
      let displayName = group.name;

      // Try to find the main character or use the first character
      if (group.characters.length > 0) {
        const mainCharacter = group.characters.find(char =>
          group.characters.some(c => c.eveId !== char.eveId && c.name.includes(char.name.split(' ')[0]))
        );

        if (mainCharacter) {
          displayName = mainCharacter.name;
        } else {
          displayName = group.characters[0].name;
        }
      }

      // Extract the data points and collect labels (cumulative sum)
      const dataPoints: number[] = [];
      const timePoints: string[] = [];

      let cumulativeKills = 0;
      let groupTotalKills = 0;

      for (const point of killData) {
        const formattedTime = format(point.timestamp, this.getDateFormat(groupBy));
        timePoints.push(formattedTime);
        timeLabels.add(formattedTime);

        cumulativeKills += point.kills;
        dataPoints.push(cumulativeKills);
        groupTotalKills += point.kills;
        allDataPoints.push(point.kills); // For trend calculation
      }

      // Update overall statistics
      overallTotalKills += groupTotalKills;

      // Add dataset for this group with area filling
      datasets.push({
        label: displayName,
        data: dataPoints,
        backgroundColor: this.adjustColorTransparency(TrendChartConfig.colors[i % TrendChartConfig.colors.length], 0.6),
        borderColor: TrendChartConfig.colors[i % TrendChartConfig.colors.length],
        fill: true,
      });
    }

    // Sort the time labels chronologically
    const sortedLabels = Array.from(timeLabels).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });

    // Calculate average kills per day
    const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const averageKillsPerDay = overallTotalKills / dayCount;

    // Calculate the trend (increasing, stable, or decreasing)
    const trend = this.calculateTrend(allDataPoints);

    // Create chart data
    const chartData: ChartData = {
      labels: sortedLabels,
      datasets,
      displayType: 'line', // Still use line type but with fill
      title: `Cumulative ${TrendChartConfig.title} - ${format(
        startDate,
        'MMM d'
      )} to ${format(endDate, 'MMM d, yyyy')}`,
      options: TrendChartConfig.areaOptions,
      summary: TrendChartConfig.getDefaultSummary(overallTotalKills, averageKillsPerDay, trend),
    };

    return chartData;
  }

  /**
   * Generate a dual-axis chart showing kills and value over time
   */
  private async generateDualAxisChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>,
    startDate: Date,
    endDate: Date,
    correlationId: string
  ): Promise<ChartData> {
    // Combine all groups for a total view
    const allCharacterIds: bigint[] = [];

    // Extract all character IDs from all groups
    for (const group of characterGroups) {
      allCharacterIds.push(...group.characters.map(char => BigInt(char.eveId)));
    }

    if (allCharacterIds.length === 0) {
      throw new ChartError('NO_DATA_AVAILABLE', 'No characters found in the provided groups', {
        context: { correlationId, operation: 'generateDualAxisChart' }
      });
    }

    // Determine appropriate time grouping
    const dateRange = endDate.getTime() - startDate.getTime();
    const days = dateRange / (1000 * 60 * 60 * 24);

    let groupBy: 'hour' | 'day' | 'week' = 'day';
    if (days <= 2) {
      groupBy = 'hour';
    } else if (days > 30) {
      groupBy = 'week';
    }

    // Get kill data grouped by time with retry logic
    const killData = await errorHandler.withRetry(
      () => this.killRepository.getKillsGroupedByTime(allCharacterIds, startDate, endDate, groupBy),
      {
        retries: 3,
        context: { operation: 'fetchDualAxisKillData', groupBy, correlationId }
      }
    );

    if (killData.length === 0) {
      throw new ChartError('NO_DATA_AVAILABLE', 'No kill data found for the specified time period', {
        context: { startDate, endDate, characterCount: allCharacterIds.length, correlationId }
      });
    }

    // Prepare data for the dual-axis chart
    const killsData: number[] = [];
    const valueData: number[] = []; // Convert bigint to number for charting
    const timeLabels: string[] = [];

    let totalKills = 0;
    const allKillsData: number[] = []; // For trend calculation

    // Process the kill data
    for (const point of killData) {
      const formattedTime = format(point.timestamp, this.getDateFormat(groupBy));
      timeLabels.push(formattedTime);

      killsData.push(point.kills);
      allKillsData.push(point.kills);
      totalKills += point.kills;

      // Convert bigint to number, handling potential overflow
      const valueInISK = Number(point.value) > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : Number(point.value);
      valueData.push(valueInISK);
    }

    // Create datasets for kills (line) and values (bar)
    const datasets = [
      {
        label: 'Kills',
        data: killsData,
        backgroundColor: this.adjustColorTransparency('#3366CC', 0.7),
        borderColor: '#3366CC',
        fill: false,
        type: 'line' as 'line',
        yAxisID: 'y',
      },
      {
        label: 'Total Value (ISK)',
        data: valueData,
        backgroundColor: this.adjustColorTransparency('#DC3912', 0.7),
        borderColor: '#DC3912',
        fill: false,
        type: 'bar' as 'bar',
        yAxisID: 'y1',
      },
    ];

    // Calculate average kills per day
    const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const averageKillsPerDay = totalKills / dayCount;

    // Calculate the trend (increasing, stable, or decreasing)
    const trend = this.calculateTrend(allKillsData);

    // Create chart data
    const chartData: ChartData = {
      labels: timeLabels,
      datasets,
      displayType: 'line', // Use line type for dual-axis chart
      title: `Kills vs. Value Over Time - ${format(startDate, 'MMM d')} to ${format(endDate, 'MMM d, yyyy')}`,
      options: TrendChartConfig.dualAxisOptions,
      summary: `${TrendChartConfig.getDefaultSummary(totalKills, averageKillsPerDay, trend)} with value metrics`,
    };

    return chartData;
  }

  /**
   * Calculate trend direction from a series of data points
   */
  private calculateTrend(dataPoints: number[]): 'increasing' | 'stable' | 'decreasing' {
    if (dataPoints.length < 3) {
      return 'stable'; // Not enough data to determine trend
    }

    // Simple linear regression to determine trend
    const n = dataPoints.length;
    const xValues = Array.from({ length: n }, (_, i) => i);

    // Calculate means
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = dataPoints.reduce((sum, y) => sum + y, 0) / n;

    // Calculate slope
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (dataPoints[i] - yMean);
      denominator += Math.pow(xValues[i] - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;

    // Determine trend direction
    if (slope > 0.05) {
      return 'increasing';
    } else if (slope < -0.05) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * Get a date format string based on the grouping level
   */
  protected override getDateFormat(groupBy: 'hour' | 'day' | 'week'): string {
    switch (groupBy) {
      case 'hour':
        return 'MMM d, HH:mm';
      case 'day':
        return 'MMM d';
      case 'week':
        return "'Week' W, MMM yyyy";
      default:
        return 'MMM d';
    }
  }

  /**
   * Adjust color transparency (for area charts)
   */
  private adjustColorTransparency(color: string, alpha: number): string {
    if (color.startsWith('#')) {
      // Convert hex to rgb
      const r = parseInt(color.substring(1, 3), 16);
      const g = parseInt(color.substring(3, 5), 16);
      const b = parseInt(color.substring(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } else if (color.startsWith('rgb(')) {
      // Convert rgb to rgba
      return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    } else if (color.startsWith('rgba(')) {
      // Replace existing alpha
      return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
    }
    return color;
  }

  /**
   * Validate chart generation options
   */
  private validateChartOptions(options: {
    startDate: Date;
    endDate: Date;
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>;
    displayType: string;
  }, correlationId: string): void {
    const issues: Array<{ field: string; message: string }> = [];

    // Validate dates
    if (!options.startDate || !(options.startDate instanceof Date) || isNaN(options.startDate.getTime())) {
      issues.push({ field: 'startDate', message: 'Invalid start date' });
    }

    if (!options.endDate || !(options.endDate instanceof Date) || isNaN(options.endDate.getTime())) {
      issues.push({ field: 'endDate', message: 'Invalid end date' });
    }

    if (options.startDate && options.endDate && options.startDate >= options.endDate) {
      issues.push({ field: 'dateRange', message: 'Start date must be before end date' });
    }

    // Validate character groups
    if (!options.characterGroups || !Array.isArray(options.characterGroups)) {
      issues.push({ field: 'characterGroups', message: 'Character groups must be an array' });
    } else {
      if (options.characterGroups.length === 0) {
        issues.push({ field: 'characterGroups', message: 'At least one character group is required' });
      }

      options.characterGroups.forEach((group, index) => {
        if (!group.groupId || typeof group.groupId !== 'string') {
          issues.push({ field: `characterGroups[${index}].groupId`, message: 'Group ID is required' });
        }

        if (!group.name || typeof group.name !== 'string') {
          issues.push({ field: `characterGroups[${index}].name`, message: 'Group name is required' });
        }

        if (!group.characters || !Array.isArray(group.characters)) {
          issues.push({ field: `characterGroups[${index}].characters`, message: 'Characters must be an array' });
        } else {
          group.characters.forEach((char, charIndex) => {
            if (!char.eveId || typeof char.eveId !== 'string') {
              issues.push({ 
                field: `characterGroups[${index}].characters[${charIndex}].eveId`, 
                message: 'Character eveId is required' 
              });
            }
            if (!char.name || typeof char.name !== 'string') {
              issues.push({ 
                field: `characterGroups[${index}].characters[${charIndex}].name`, 
                message: 'Character name is required' 
              });
            }
          });
        }
      });
    }

    if (issues.length > 0) {
      throw new ValidationError('Invalid chart generation options', issues, { 
        context: { correlationId, operation: 'validateTrendChartOptions' }
      });
    }
  }
}
