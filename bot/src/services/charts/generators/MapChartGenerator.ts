import { BaseChartGenerator } from '../BaseChartGenerator';
import { ChartData } from '../../../types/chart';
import { MapActivityRepository } from '../../../infrastructure/repositories/MapActivityRepository';
import { RepositoryManager } from '../../../infrastructure/repositories/RepositoryManager';
import { logger } from '../../../lib/logger';
import { errorHandler, ChartError, ValidationError } from '../../../shared/errors';

/**
 * Generator for map activity charts
 */
export class MapChartGenerator extends BaseChartGenerator {
  private mapActivityRepository: MapActivityRepository;

  /**
   * Create a new map activity chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    this.mapActivityRepository = this.repoManager.getMapActivityRepository();
  }

  /**
   * Generate a map activity chart based on the provided options
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
      const { startDate, endDate, characterGroups } = options;

      // Input validation
      this.validateChartOptions(options, correlationId);

      logger.info(`MapChartGenerator: Processing ${characterGroups.length} character groups`, { correlationId });
      logger.info(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`, { correlationId });

      // Get all character IDs from all groups
      const characterIds = characterGroups.flatMap(group => group.characters.map(c => c.eveId));

      logger.info(`Total characters across all groups: ${characterIds.length}`, { correlationId });

      // Get map activity for all characters with retry logic
      const activities = await errorHandler.withRetry(
        () => this.mapActivityRepository.getActivityForCharacters(characterIds, startDate, endDate),
        3,
        1000,
        { operation: 'fetchMapActivity', metadata: { characterCount: characterIds.length }, correlationId }
      );

      logger.info(`Found ${activities.length} activity records`, { correlationId });

      // Check if we have any data to work with
      if (activities.length === 0) {
        logger.warn('No map activity found for the specified time period and characters', { correlationId });
        throw new ChartError(
          'CHART_DATA_ERROR',
          'No map activity found in the specified time period',
          'map',
          { metadata: { startDate, endDate, characterCount: characterIds.length }, correlationId }
        );
      }

      // Group activities by character group
      const groupData = characterGroups.map(group => {
        // Filter out characters with invalid eveIds and convert valid ones to BigInt
        const validCharacters = group.characters.filter(c => {
          // Debug log the actual character data
          logger.info(`Character in group ${group.name}: ${JSON.stringify(c)}`, { correlationId });

          if (!c.eveId || c.eveId === '' || c.eveId === 'undefined' || c.eveId === 'null') {
            logger.warn(`Skipping character with invalid eveId in group ${group.name}: ${JSON.stringify(c)}`, { correlationId });
            return false;
          }
          return true;
        });

      const groupCharacterIds = validCharacters
        .map(c => {
          try {
            return BigInt(c.eveId);
          } catch (error) {
            logger.warn(`Failed to convert character eveId to BigInt: ${c.eveId}`, { error, correlationId });
            return null;
          }
        })
        .filter((id): id is bigint => id !== null);

      const groupActivities = activities.filter((activity: { characterId: bigint | null | undefined }) => {
        if (activity.characterId === null || activity.characterId === undefined) {
          return false;
        }
        return groupCharacterIds.includes(activity.characterId);
      });

      // Calculate totals for each metric
      const totalSignatures = groupActivities.reduce((sum: number, activity: { signatures: number }) => sum + activity.signatures, 0);
      const totalConnections = groupActivities.reduce((sum: number, activity: { connections: number }) => sum + activity.connections, 0);
      const totalPassages = groupActivities.reduce((sum: number, activity: { passages: number }) => sum + activity.passages, 0);

      return {
        group,
        activities: groupActivities,
        totalSignatures,
        totalConnections,
        totalPassages,
      };
    });

    // Sort groups by total activity (sum of all metrics)
    groupData.sort(
      (a, b) =>
        b.totalSignatures +
        b.totalConnections +
        b.totalPassages -
        (a.totalSignatures + a.totalConnections + a.totalPassages)
    );

      // Create chart data
      return {
        labels: groupData.map(data => this.getGroupDisplayName(data.group)),
        datasets: [
          {
            label: 'Signatures',
            data: groupData.map(data => data.totalSignatures),
            backgroundColor: this.getDatasetColors('map').primary,
          },
          {
            label: 'Connections',
            data: groupData.map(data => data.totalConnections),
            backgroundColor: this.getDatasetColors('map').secondary,
          },
          {
            label: 'Passages',
            data: groupData.map(data => data.totalPassages),
            backgroundColor: this.getColorForIndex(2),
          },
        ],
        displayType: 'horizontalBar',
      };
    } catch (error) {
      logger.error('Error generating map activity chart', { 
        error, 
        correlationId,
        context: { 
          operation: 'generateMapChart',
          hasOptions: !!options,
          characterGroupCount: options?.characterGroups?.length || 0
        }
      });

      if (error instanceof ChartError || error instanceof ValidationError) {
        throw error;
      }

      throw new ChartError(
        'CHART_GENERATION_ERROR',
        'Failed to generate map activity chart',
        'map',
        { correlationId, operation: 'generateMapChart' },
        error instanceof Error ? error : undefined
      );
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
    const issues: Array<{ field: string; value: any; constraint: string; message: string }> = [];

    // Validate dates
    if (!options.startDate || !(options.startDate instanceof Date) || isNaN(options.startDate.getTime())) {
      issues.push({ field: 'startDate', value: options.startDate, constraint: 'date', message: 'Invalid start date' });
    }

    if (!options.endDate || !(options.endDate instanceof Date) || isNaN(options.endDate.getTime())) {
      issues.push({ field: 'endDate', value: options.endDate, constraint: 'date', message: 'Invalid end date' });
    }

    if (options.startDate && options.endDate && options.startDate >= options.endDate) {
      issues.push({ field: 'dateRange', value: { startDate: options.startDate, endDate: options.endDate }, constraint: 'range', message: 'Start date must be before end date' });
    }

    // Validate character groups
    if (!options.characterGroups || !Array.isArray(options.characterGroups)) {
      issues.push({ field: 'characterGroups', value: options.characterGroups, constraint: 'array', message: 'Character groups must be an array' });
    } else {
      if (options.characterGroups.length === 0) {
        issues.push({ field: 'characterGroups', value: options.characterGroups, constraint: 'minLength', message: 'At least one character group is required' });
      }

      options.characterGroups.forEach((group, index) => {
        if (!group.groupId || typeof group.groupId !== 'string') {
          issues.push({ field: `characterGroups[${index}].groupId`, value: group.groupId, constraint: 'required', message: 'Group ID is required' });
        }

        if (!group.name || typeof group.name !== 'string') {
          issues.push({ field: `characterGroups[${index}].name`, value: group.name, constraint: 'required', message: 'Group name is required' });
        }

        if (!group.characters || !Array.isArray(group.characters)) {
          issues.push({ field: `characterGroups[${index}].characters`, value: group.characters, constraint: 'array', message: 'Characters must be an array' });
        } else {
          group.characters.forEach((char, charIndex) => {
            if (!char.eveId || typeof char.eveId !== 'string') {
              issues.push({ 
                field: `characterGroups[${index}].characters[${charIndex}].eveId`, 
                value: char.eveId,
                constraint: 'required',
                message: 'Character eveId is required' 
              });
            }
            if (!char.name || typeof char.name !== 'string') {
              issues.push({ 
                field: `characterGroups[${index}].characters[${charIndex}].name`, 
                value: char.name,
                constraint: 'required',
                message: 'Character name is required' 
              });
            }
          });
        }
      });
    }

    if (issues.length > 0) {
      throw new ValidationError('Invalid chart generation options', issues, { 
        correlationId, operation: 'validateMapChartOptions'
      });
    }
  }
}
