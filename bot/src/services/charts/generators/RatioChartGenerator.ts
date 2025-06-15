import { BaseChartGenerator } from '../BaseChartGenerator';
import { ChartData } from '../../../types/chart';
import { logger } from '../../../lib/logger';
import { KillRepository } from '../../../infrastructure/repositories/KillRepository';
import { LossRepository } from '../../../infrastructure/repositories/LossRepository';
import { RepositoryManager } from '../../../infrastructure/repositories/RepositoryManager';
import { errorHandler, ChartError, ValidationError } from '../../../lib/errors';

/**
 * Generator for kill-death ratio charts
 */
export class RatioChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;
  private lossRepository: LossRepository;

  /**
   * Create a new ratio chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    this.killRepository = this.repoManager.getKillRepository();
    this.lossRepository = this.repoManager.getLossRepository();
  }

  /**
   * Generate a kill-death ratio chart
   */
  async generateChart(options: {
    startDate: Date;
    endDate: Date;
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>;
    displayType: string;
  }): Promise<ChartData> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      // Input validation
      this.validateChartOptions(options, correlationId);

      logger.info('Generating kill-death ratio chart', { correlationId });

      const { startDate, endDate, characterGroups } = options;
      logger.info(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`, { correlationId });

      // Prepare data arrays
      const filteredLabels: string[] = [];
      const kdRatios: number[] = [];
      const efficiencies: number[] = [];

      logger.info(`Processing ${characterGroups.length} character groups`, { correlationId });

      for (const group of characterGroups) {
        const characterIds = group.characters.map(char => BigInt(char.eveId));
        if (characterIds.length === 0) continue;
        
        // Compute stats manually with retry logic
        const [kills, lossesSummary] = await Promise.all([
          errorHandler.withRetry(
            () => this.killRepository.getKillsForCharacters(characterIds, startDate, endDate),
            {
              retries: 3,
              context: { operation: 'fetchKillsForRatio', groupId: group.groupId, correlationId }
            }
          ),
          errorHandler.withRetry(
            () => this.lossRepository.getLossesSummaryByCharacters(characterIds, startDate, endDate),
            {
              retries: 3,
              context: { operation: 'fetchLossesForRatio', groupId: group.groupId, correlationId }
            }
          )
        ]);
        const totalKills = kills.length;
        const totalLosses = lossesSummary.totalLosses;
        
        logger.debug(`Group ${group.name}: ${totalKills} kills, ${totalLosses} losses`, { correlationId });
        
        // Only include groups with at least one kill or death
        if (totalKills > 0 || totalLosses > 0) {
          // Use main character name if available
          let label = group.name;
          if (group.mainCharacterId) {
            const mainChar = group.characters.find(c => c.eveId === group.mainCharacterId);
            if (mainChar) label = mainChar.name;
          } else if (group.characters.length > 0) {
            label = group.characters[0].name;
          }
          filteredLabels.push(label);
          let kdRatio = 0;
          if (totalLosses > 0) {
            kdRatio = totalKills / totalLosses;
          } else if (totalKills > 0) {
            kdRatio = totalKills;
          }
          let efficiency = 0;
          if (totalKills + totalLosses > 0) {
            efficiency = (totalKills / (totalKills + totalLosses)) * 100;
          }
          kdRatios.push(kdRatio);
          efficiencies.push(efficiency);
        }
      }

      // Check if we have any data to work with
      if (filteredLabels.length === 0) {
        logger.warn('No groups with kills or losses found for ratio calculation', { correlationId });
        throw new ChartError('NO_DATA_AVAILABLE', 'No kills or losses found in the specified time period', {
          context: { startDate, endDate, characterGroupCount: characterGroups.length, correlationId }
        });
      }

      // Generate summary text
      const timeRangeText = this.getTimeRangeText(startDate, endDate);
      let summary = `Kill-Death ratios for tracked characters (${timeRangeText})`;

      // Add top performer if there's data
      if (Math.max(...kdRatios) > 0) {
        const bestGroupIndex = kdRatios.indexOf(Math.max(...kdRatios));
        summary += `\nBest performer: ${
          filteredLabels[bestGroupIndex]
        } with K/D ratio of ${kdRatios[bestGroupIndex].toFixed(2)}`;
      }

      logger.info(`Generated ratio data for ${filteredLabels.length} groups`, { correlationId });

      return {
        labels: filteredLabels,
        datasets: [
          {
            label: 'K/D Ratio',
            data: kdRatios,
            backgroundColor: '#3366CC',
            borderColor: '#3366CC',
          },
          {
            label: 'Efficiency %',
            data: efficiencies,
            backgroundColor: '#DC3912',
            borderColor: '#DC3912',
          },
        ],
        title: `Kill-Death Ratio - ${timeRangeText}`,
        summary,
        displayType: 'bar',
      };
    } catch (error) {
      logger.error('Error generating ratio chart', { 
        error, 
        correlationId,
        context: { 
          operation: 'generateRatioChart',
          hasOptions: !!options,
          characterGroupCount: options?.characterGroups?.length || 0
        }
      });

      if (error instanceof ChartError || error instanceof ValidationError) {
        throw error;
      }

      throw new ChartError('CHART_GENERATION_FAILED', 'Failed to generate ratio chart', {
        cause: error,
        context: { correlationId, operation: 'generateRatioChart' }
      });
    }
  }

  /**
   * Get a formatted string describing the time range
   */
  private getTimeRangeText(startDate: Date, endDate: Date): string {
    const diffDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      return 'Last 24 hours';
    } else if (diffDays <= 7) {
      return 'Last 7 days';
    } else if (diffDays <= 30) {
      return 'Last 30 days';
    } else {
      return `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
    }
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
      mainCharacterId?: string;
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
        context: { correlationId, operation: 'validateRatioChartOptions' }
      });
    }
  }
}
