import { BaseChartService } from '../BaseChartService';
import { IKillsChartService } from '../interfaces/IKillsChartService';
import { ChartData, ChartDisplayType, ChartMetric } from '../../../types/chart';
import { Character } from '../../../domain/character/Character';
import { format } from 'date-fns';
/* eslint-disable max-lines */
import { logger } from '../../../lib/logger';
import { errorHandler, ChartError, ValidationError } from '../../../lib/errors';

interface KillData {
  killTime: Date;
  totalValue: bigint;
  points: number;
  attackerCount: number;
  characters: Array<{ characterId: bigint }>;
}

export class KillsChartService extends BaseChartService implements IKillsChartService {
  async generateKillsChart(
    characterIds: string[],
    startDate: Date,
    groupBy: string,
    displayMetric: ChartMetric,
    limit: number
  ): Promise<ChartData> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      // Input validation
      this.validateKillsChartInput({ characterIds, startDate, groupBy, displayMetric, limit }, correlationId);

      const characterIdsBigInt = characterIds.map(id => BigInt(id));

      logger.info(`Generating kills chart for ${characterIds.length} characters from ${startDate.toISOString()}`, { correlationId });
      logger.info(`Character IDs: ${characterIds.join(', ')}`, { correlationId });
      // Find all related characters via character groups with retry logic
      const allCharactersNested = await Promise.all(
        characterIds.map(async (id: string) => {
          return errorHandler.withRetry(
            async () => {
              const character = await this.characterRepository.getCharacter(BigInt(id));
              if (character?.characterGroupId) {
                return this.characterRepository.getCharactersByGroup(character.characterGroupId);
              }
              return character ? [character] : [];
            },
            {
              retries: 3,
              context: { operation: 'fetchCharacterGroups', characterId: id, correlationId }
            }
          );
        })
      );
      const allCharacters = allCharactersNested.flat();
      const allCharacterIds = allCharacters.map((c: Character) => c.eveId);

      logger.info(`Including all characters in same groups: ${allCharacters.length} characters total`, { correlationId });

      // Get kills for characters with retry logic
      logger.info('Querying killFact table with expanded character list...', { correlationId });
      const killsQuery = await errorHandler.withRetry(
        () => this.killRepository.getKillsForCharacters(
          allCharacterIds.map(id => BigInt(id)),
          startDate,
          new Date()
        ),
        {
          retries: 3,
          context: { operation: 'fetchKillsData', characterCount: allCharacterIds.length, correlationId }
        }
      );

      logger.info(`Found ${killsQuery.length} kill records in database`, { correlationId });

      if (killsQuery.length === 0) {
        logger.warn('No kills found for specified characters and time period', { correlationId });
        return this.createEmptyKillsChart(characterIdsBigInt, groupBy, limit, correlationId);
      }

      const kills = killsQuery.map((kill: any) => {
        logger.debug(`Processing kill: ID ${kill.killmail_id}, time ${kill.kill_time}, character ${kill.character_id}`);

        return {
          killTime: new Date(kill.kill_time),
          totalValue: BigInt(kill.total_value),
          points: kill.points,
          attackerCount: kill.attackers?.length ?? 0,
          characters:
            kill.characters?.map((char: any) => ({
              characterId: BigInt(char.character_id),
            })) ?? [],
        };
      });

      // Group data by time periods and character
      const groupedData = this.groupKillsByTimeAndCharacter(kills, groupBy, allCharacters);

      // Create chart datasets
      const datasets = await this.createKillsDatasets(groupedData, characterIdsBigInt, displayMetric, limit);

      // Generate time labels
      const labels = this.generateTimeLabels(startDate, new Date(), groupBy);

      return {
        labels,
        datasets,
        title: this.generateChartTitle('kills', displayMetric, this.periodFromDates(startDate)),
        displayType: 'line' as ChartDisplayType,
      };
    } catch (error) {
      logger.error('Error generating kills chart', { 
        error, 
        correlationId,
        context: { 
          operation: 'generateKillsChart',
          characterCount: characterIds?.length || 0,
          groupBy,
          displayMetric,
          limit
        }
      });

      if (error instanceof ChartError || error instanceof ValidationError) {
        throw error;
      }

      throw new ChartError('CHART_GENERATION_FAILED', 'Failed to generate kills chart', {
        cause: error,
        context: { correlationId, operation: 'generateKillsChart' }
      });
    }
  }

  async generateGroupedKillsChart(config: {
    characterGroups: string[];
    period: string;
    groupBy: string;
    displayType: ChartDisplayType;
    displayMetric: ChartMetric;
    limit: number;
  }): Promise<ChartData> {
    const startDate = this.calculateStartDate(config.period);

    logger.info(
      `Generating grouped kills chart for ${config.characterGroups.length} groups from ${startDate.toISOString()}`
    );

    try {
      // Get all characters from the specified groups
      const characterGroups = await Promise.all(
        config.characterGroups.map(async groupId => {
          const group = await this.characterRepository.getCharacterGroup(groupId);
          return {
            group,
            characters: group ? await this.characterRepository.getCharactersByGroup(groupId) : [],
          };
        })
      );

      // Process each group
      const datasets = await Promise.all(
        characterGroups.map(async (groupData, index) => {
          const { group, characters } = groupData;

          if (!group || characters.length === 0) {
            return {
              label: group?.name ?? `Group ${index + 1}`,
              data: [],
              borderColor: this.getColor(index),
              fill: false,
            };
          }

          const characterIds = characters.map(c => BigInt(c.eveId));
          const killsQuery = await this.killRepository.getKillsForCharacters(characterIds, startDate, new Date());

          const kills = killsQuery.map((kill: any) => ({
            killTime: new Date(kill.kill_time),
            totalValue: BigInt(kill.total_value),
            points: kill.points,
            attackerCount: kill.attackers?.length ?? 0,
            characters:
              kill.characters?.map((char: any) => ({
                characterId: BigInt(char.character_id),
              })) ?? [],
          }));

          const groupedData = this.groupKillsByTime(kills, config.groupBy);
          const chartData = this.calculateDisplayMetricData(groupedData, config.displayMetric);

          return {
            label: group.name,
            data: chartData,
            borderColor: this.getColor(index),
            fill: false,
          };
        })
      );

      const labels = this.generateTimeLabels(startDate, new Date(), config.groupBy);

      return {
        labels,
        datasets,
        title: this.generateChartTitle('kills', config.displayMetric, config.period),
        displayType: config.displayType,
      };
    } catch (error) {
      logger.error('Error generating grouped kills chart:', error);
      throw error;
    }
  }

  private async createEmptyKillsChart(characterIds: bigint[], groupBy: string, limit: number, correlationId: string): Promise<ChartData> {
    logger.warn('No kills found for the specified characters and time period', { correlationId });

    const emptyDatasets = await Promise.all(
      characterIds.slice(0, limit).map(async (characterId, index) => {
        try {
          const character = await this.characterRepository.getCharacter(characterId);
          return {
            label: character?.name ?? `Character ${characterId}`,
            data: [],
            borderColor: this.getColor(index),
            fill: false,
          };
        } catch (err) {
          return {
            label: `Character ${characterId}`,
            data: [],
            borderColor: this.getColor(index),
            fill: false,
          };
        }
      })
    );

    const labels = this.generateEmptyTimeLabels(groupBy);

    return {
      labels,
      datasets: emptyDatasets,
      title: '',
      displayType: 'line' as ChartDisplayType,
    };
  }

  private groupKillsByTimeAndCharacter(
    kills: KillData[],
    groupBy: string,
    characters: Character[]
  ): Map<string, Map<string, any>> {
    const grouped = new Map<string, Map<string, any>>();

    for (const kill of kills) {
      const timeKey = this.getTimeKey(kill.killTime, groupBy);

      if (!grouped.has(timeKey)) {
        grouped.set(timeKey, new Map());
      }

      // TypeScript assertion: we just created this map if it didn't exist
      const timeGroup = grouped.get(timeKey) as Map<string, any>;

      for (const killChar of kill.characters) {
        const character = characters.find(c => BigInt(c.eveId) === killChar.characterId);
        if (!character) continue;

        const charKey = character.eveId.toString();

        if (!timeGroup.has(charKey)) {
          timeGroup.set(charKey, {
            kills: 0,
            totalValue: BigInt(0),
            points: 0,
            attackers: 0,
          });
        }

        const charData = timeGroup.get(charKey);
        if (charData) {
          charData.kills += 1;
          charData.totalValue += kill.totalValue;
          charData.points += kill.points;
          charData.attackers += kill.attackerCount;
        }
      }
    }

    return grouped;
  }

  private groupKillsByTime(kills: KillData[], groupBy: string): Map<string, any> {
    const grouped = new Map<string, any>();

    kills.forEach(kill => {
      const timeKey = this.getTimeKey(kill.killTime, groupBy);

      if (!grouped.has(timeKey)) {
        grouped.set(timeKey, {
          kills: 0,
          totalValue: BigInt(0),
          points: 0,
          attackers: 0,
        });
      }

      const timeData = grouped.get(timeKey);
      timeData.kills += 1;
      timeData.totalValue += kill.totalValue;
      timeData.points += kill.points;
      timeData.attackers += kill.attackerCount;
    });

    return grouped;
  }

  private async createKillsDatasets(
    groupedData: Map<string, Map<string, any>>,
    characterIds: bigint[],
    displayMetric: ChartMetric,
    limit: number
  ): Promise<any[]> {
    const limitedCharacterIds = characterIds.slice(0, limit);

    return Promise.all(
      limitedCharacterIds.map(async (characterId, index) => {
        const character = await this.characterRepository.getCharacter(characterId);
        const charKey = characterId.toString();

        const data: number[] = [];

        for (const [, timeGroup] of groupedData) {
          const charData = timeGroup.get(charKey);
          if (charData) {
            data.push(this.getMetricValue(charData, displayMetric));
          } else {
            data.push(0);
          }
        }

        return {
          label: character?.name ?? `Character ${characterId}`,
          data,
          borderColor: this.getColor(index),
          fill: false,
        };
      })
    );
  }

  private calculateDisplayMetricData(groupedData: Map<string, any>, displayMetric: ChartMetric): number[] {
    const data: number[] = [];

    for (const [, timeData] of groupedData) {
      data.push(this.getMetricValue(timeData, displayMetric));
    }

    return data;
  }

  private getMetricValue(data: any, displayMetric: ChartMetric): number {
    switch (displayMetric) {
      case 'value':
        return Number(data.totalValue) / 1000000; // Convert to millions
      case 'kills':
        return data.kills;
      case 'points':
        return data.points;
      case 'attackers':
        return data.attackers;
      default:
        return 0;
    }
  }

  private getTimeKey(date: Date, groupBy: string): string {
    switch (groupBy) {
      case 'hour':
        return format(date, 'yyyy-MM-dd HH:00');
      case 'day':
        return format(date, 'yyyy-MM-dd');
      case 'week': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return format(weekStart, 'yyyy-MM-dd');
      }
      default:
        return format(date, 'yyyy-MM-dd');
    }
  }

  private generateTimeLabels(startDate: Date, endDate: Date, groupBy: string): string[] {
    const labels: string[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      labels.push(this.formatLabel(current, groupBy));

      switch (groupBy) {
        case 'hour':
          current.setHours(current.getHours() + 1);
          break;
        case 'day':
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          current.setDate(current.getDate() + 7);
          break;
      }
    }

    return labels;
  }

  private generateEmptyTimeLabels(groupBy: string): string[] {
    const labels = [];
    const today = new Date();
    const daysToGenerate = groupBy === 'hour' ? 1 : groupBy === 'day' ? 7 : 4;

    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      labels.push(this.formatLabel(date, groupBy));
    }

    return labels;
  }

  private formatLabel(date: Date, groupBy: string): string {
    switch (groupBy) {
      case 'hour':
        return format(date, 'HH:mm');
      case 'day':
        return format(date, 'MMM dd');
      case 'week':
        return format(date, 'MMM dd');
      default:
        return format(date, 'MMM dd');
    }
  }

  private periodFromDates(startDate: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - startDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    if (diffHours <= 24) return '24h';
    if (diffDays <= 7) return '7d';
    if (diffDays <= 30) return '30d';
    return '90d';
  }

  /**
   * Validate kills chart input parameters
   */
  private validateKillsChartInput(params: {
    characterIds: string[];
    startDate: Date;
    groupBy: string;
    displayMetric: ChartMetric;
    limit: number;
  }, correlationId: string): void {
    const issues: Array<{ field: string; message: string }> = [];

    // Validate character IDs
    if (!params.characterIds || !Array.isArray(params.characterIds) || params.characterIds.length === 0) {
      issues.push({ field: 'characterIds', message: 'At least one character ID is required' });
    } else {
      params.characterIds.forEach((id, index) => {
        if (!id || typeof id !== 'string') {
          issues.push({ field: `characterIds[${index}]`, message: 'Character ID must be a non-empty string' });
        }
      });
    }

    // Validate start date
    if (!params.startDate || !(params.startDate instanceof Date) || isNaN(params.startDate.getTime())) {
      issues.push({ field: 'startDate', message: 'Invalid start date' });
    }

    // Validate groupBy
    const validGroupBy = ['hour', 'day', 'week'];
    if (!params.groupBy || !validGroupBy.includes(params.groupBy)) {
      issues.push({ field: 'groupBy', message: `GroupBy must be one of: ${validGroupBy.join(', ')}` });
    }

    // Validate display metric
    const validMetrics = ['kills', 'value', 'points', 'attackers'];
    if (!params.displayMetric || !validMetrics.includes(params.displayMetric)) {
      issues.push({ field: 'displayMetric', message: `Display metric must be one of: ${validMetrics.join(', ')}` });
    }

    // Validate limit
    if (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 100) {
      issues.push({ field: 'limit', message: 'Limit must be a number between 1 and 100' });
    }

    if (issues.length > 0) {
      throw new ValidationError('Invalid kills chart input parameters', issues, { 
        context: { correlationId, operation: 'validateKillsChartInput' }
      });
    }
  }
}
