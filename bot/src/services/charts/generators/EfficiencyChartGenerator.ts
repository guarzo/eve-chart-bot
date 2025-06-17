import { BaseChartGenerator } from '../BaseChartGenerator';
import { ChartData } from '../../../types/chart';
import { KillRepository } from '../../../infrastructure/repositories/KillRepository';
import { LossRepository } from '../../../infrastructure/repositories/LossRepository';
import { logger } from '../../../lib/logger';
import { RepositoryManager } from '../../../infrastructure/repositories/RepositoryManager';
import { errorHandler, ChartError, ValidationError, ValidationIssue } from '../../../shared/errors';
import { BigIntTransformer } from '../../../shared/utilities/BigIntTransformer';

/**
 * Generator for efficiency charts
 */
export class EfficiencyChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;
  private lossRepository: LossRepository;

  /**
   * Create a new efficiency chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    this.killRepository = this.repoManager.getKillRepository();
    this.lossRepository = this.repoManager.getLossRepository();
  }

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
      const { startDate, endDate, characterGroups } = options;

      // Input validation
      this.validateChartOptions(options, correlationId);

      logger.info('Generating efficiency chart', { correlationId });
      logger.info(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`, { correlationId });

      // Get all character IDs from all groups using standardized transformer
      const characterIds = characterGroups.flatMap(group => BigIntTransformer.migrateCharacterIds(group.characters));

      logger.info(`Total characters across all groups: ${characterIds.length}`, { correlationId });

      // Get kills and losses for all characters with retry logic
      const [kills, losses] = await Promise.all([
        errorHandler.withRetry(
          () => this.killRepository.getKillsForCharacters(characterIds, startDate, endDate),
          3,
          1000,
          { operation: 'fetchKillsForEfficiency', correlationId, metadata: { characterCount: characterIds.length } }
        ),
        errorHandler.withRetry(() => this.lossRepository.getLossesByTimeRange(startDate, endDate), 3, 1000, {
          operation: 'fetchLossesForEfficiency',
          correlationId,
        }),
      ]);

      logger.info(`Found ${kills.length} kills and ${losses.length} losses`, { correlationId });

      // Group data by character group using standardized transformer
      const groupData = characterGroups.map(group => {
        const groupCharacterIds = BigIntTransformer.migrateCharacterIds(group.characters);
        const groupKills = kills.filter(kill =>
          groupCharacterIds.includes(BigIntTransformer.toBigInt(kill.character_id) || BigInt(0))
        );
        const groupLosses = losses.filter(loss =>
          groupCharacterIds.includes(BigIntTransformer.toBigInt(loss.characterId) || BigInt(0))
        );

        const totalKills = groupKills.length;
        const totalLosses = groupLosses.length;
        const efficiency = totalKills + totalLosses > 0 ? (totalKills / (totalKills + totalLosses)) * 100 : 0;

        return {
          group,
          kills: groupKills,
          losses: groupLosses,
          totalKills,
          totalLosses,
          efficiency,
        };
      });

      // Check if we have any data to work with
      const totalActivity = groupData.reduce((sum, data) => sum + data.totalKills + data.totalLosses, 0);
      if (totalActivity === 0) {
        logger.warn('No kills or losses found for efficiency calculation', { correlationId });
        throw ChartError.noDataError('efficiency', 'No kills or losses found in the specified time period', {
          correlationId,
          metadata: { startDate, endDate, characterCount: characterIds.length },
        });
      }

      // Sort groups by efficiency
      groupData.sort((a, b) => b.efficiency - a.efficiency);

      logger.info(`Generated efficiency data for ${groupData.length} groups`, { correlationId });

      // Create chart data
      return {
        labels: groupData.map(data => this.getGroupDisplayName(data.group)),
        datasets: [
          {
            label: 'Efficiency (%)',
            data: groupData.map(data => data.efficiency),
            backgroundColor: this.getDatasetColors('kills').primary,
          },
          {
            label: 'Total Kills',
            data: groupData.map(data => data.totalKills),
            backgroundColor: this.getDatasetColors('kills').secondary,
          },
          {
            label: 'Total Losses',
            data: groupData.map(data => data.totalLosses),
            backgroundColor: this.getDatasetColors('loss').primary,
          },
        ],
        displayType: 'horizontalBar',
      };
    } catch (error) {
      logger.error('Error generating efficiency chart', {
        error,
        correlationId,
        context: {
          operation: 'generateEfficiencyChart',
          hasOptions: !!options,
          characterGroupCount: options?.characterGroups?.length || 0,
        },
      });

      if (error instanceof ChartError || error instanceof ValidationError) {
        throw error;
      }

      throw ChartError.generationError(
        'efficiency',
        'Failed to generate efficiency chart',
        {
          correlationId,
          operation: 'generateEfficiencyChart',
        },
        error as Error
      );
    }
  }

  /**
   * Validate chart generation options
   */
  private validateChartOptions(
    options: {
      startDate: Date;
      endDate: Date;
      characterGroups: Array<{
        groupId: string;
        name: string;
        characters: Array<{ eveId: string; name: string }>;
        mainCharacterId?: string;
      }>;
      displayType: string;
    },
    correlationId: string
  ): void {
    const issues: ValidationIssue[] = [];

    // Validate dates
    if (!options.startDate || !(options.startDate instanceof Date) || isNaN(options.startDate.getTime())) {
      issues.push({
        field: 'startDate',
        value: options.startDate,
        constraint: 'format',
        message: 'Invalid start date',
      });
    }

    if (!options.endDate || !(options.endDate instanceof Date) || isNaN(options.endDate.getTime())) {
      issues.push({ field: 'endDate', value: options.endDate, constraint: 'format', message: 'Invalid end date' });
    }

    if (options.startDate && options.endDate && options.startDate >= options.endDate) {
      issues.push({
        field: 'dateRange',
        value: { startDate: options.startDate, endDate: options.endDate },
        constraint: 'dateOrder',
        message: 'Start date must be before end date',
      });
    }

    // Validate character groups
    if (!options.characterGroups || !Array.isArray(options.characterGroups)) {
      issues.push({
        field: 'characterGroups',
        value: options.characterGroups,
        constraint: 'type',
        message: 'Character groups must be an array',
      });
    } else {
      if (options.characterGroups.length === 0) {
        issues.push({
          field: 'characterGroups',
          value: options.characterGroups,
          constraint: 'minLength',
          message: 'At least one character group is required',
        });
      }

      options.characterGroups.forEach((group, index) => {
        if (!group.groupId || typeof group.groupId !== 'string') {
          issues.push({
            field: `characterGroups[${index}].groupId`,
            value: group.groupId,
            constraint: 'required',
            message: 'Group ID is required',
          });
        }

        if (!group.name || typeof group.name !== 'string') {
          issues.push({
            field: `characterGroups[${index}].name`,
            value: group.name,
            constraint: 'required',
            message: 'Group name is required',
          });
        }

        if (!group.characters || !Array.isArray(group.characters)) {
          issues.push({
            field: `characterGroups[${index}].characters`,
            value: group.characters,
            constraint: 'type',
            message: 'Characters must be an array',
          });
        } else {
          group.characters.forEach((char, charIndex) => {
            if (!char.eveId || typeof char.eveId !== 'string') {
              issues.push({
                field: `characterGroups[${index}].characters[${charIndex}].eveId`,
                value: char.eveId,
                constraint: 'required',
                message: 'Character eveId is required',
              });
            }
            if (!char.name || typeof char.name !== 'string') {
              issues.push({
                field: `characterGroups[${index}].characters[${charIndex}].name`,
                value: char.name,
                constraint: 'required',
                message: 'Character name is required',
              });
            }
          });
        }
      });
    }

    if (issues.length > 0) {
      throw new ValidationError('Invalid chart generation options', issues, {
        correlationId,
        operation: 'validateEfficiencyChartOptions',
      });
    }
  }
}
