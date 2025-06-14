import { BaseChartService } from '../BaseChartService';
import { IMapActivityChartService } from '../interfaces/IMapActivityChartService';
import { ChartData, ChartDisplayType, ChartMetric } from '../../../types/chart';
import { Character } from '../../../domain/character/Character';
import { format } from 'date-fns';
/* eslint-disable max-lines */
import { logger } from '../../../lib/logger';

interface ActivityData {
  timestamp: Date;
  signatures: number;
  characterId: bigint;
}

export class MapActivityChartService extends BaseChartService implements IMapActivityChartService {
  async generateMapActivityChart(
    characterIds: string[],
    startDate: Date,
    groupBy: string,
    displayMetric: ChartMetric,
    limit: number
  ): Promise<ChartData> {
    const characterIdsBigInt = characterIds.map(id => BigInt(id));

    logger.info(`Generating map activity chart for ${characterIds.length} characters from ${startDate.toISOString()}`);

    try {
      // Find all related characters via character groups
      const allCharactersNested = await Promise.all(
        characterIds.map(async (id: string) => {
          const character = await this.characterRepository.getCharacter(BigInt(id));
          if (character?.characterGroupId) {
            return this.characterRepository.getCharactersByGroup(character.characterGroupId);
          }
          return character ? [character] : [];
        })
      );
      const allCharacters = allCharactersNested.flat();
      const allCharacterIds = allCharacters.map((c: Character) => c.eveId);

      // Get map activity data
      const activityQuery = await this.mapActivityRepository.getActivityForCharacters(
        allCharacterIds,
        startDate,
        new Date()
      );

      logger.info(`Found ${activityQuery.length} activity records in database`);

      if (activityQuery.length === 0) {
        return this.createEmptyActivityChart(characterIdsBigInt, groupBy, limit);
      }

      const activities = activityQuery.map((activity: any) => ({
        timestamp: new Date(activity.timestamp),
        signatures: activity.signatures ?? 0,
        characterId: BigInt(activity.character_id),
      }));

      // Group data by time periods and character
      const groupedData = this.groupActivitiesByTimeAndCharacter(activities, groupBy, allCharacters);

      // Create chart datasets
      const datasets = await this.createActivityDatasets(groupedData, characterIdsBigInt, displayMetric, limit);

      // Generate time labels
      const labels = this.generateTimeLabels(startDate, new Date(), groupBy);

      return {
        labels,
        datasets,
        title: this.generateChartTitle('map_activity', displayMetric, this.periodFromDates(startDate)),
        displayType: 'line' as ChartDisplayType,
      };
    } catch (error) {
      logger.error('Error generating map activity chart:', error);
      throw error;
    }
  }

  async generateGroupedMapActivityChart(config: {
    characterGroups: string[];
    period: string;
    groupBy: string;
    displayType: ChartDisplayType;
    displayMetric: ChartMetric;
    limit: number;
  }): Promise<ChartData> {
    const startDate = this.calculateStartDate(config.period);

    logger.info(
      `Generating grouped map activity chart for ${config.characterGroups.length} groups from ${startDate.toISOString()}`
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

          const characterIds = characters.map(c => c.eveId);
          const activitiesQuery = await this.mapActivityRepository.getActivityForCharacters(
            characterIds,
            startDate,
            new Date()
          );

          const activities = activitiesQuery.map((activity: any) => ({
            timestamp: new Date(activity.timestamp),
            signatures: activity.signatures ?? 0,
            characterId: BigInt(activity.character_id),
          }));

          const groupedData = this.groupActivitiesByTime(activities, config.groupBy);
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
        title: this.generateChartTitle('map_activity', config.displayMetric, config.period),
        displayType: config.displayType,
      };
    } catch (error) {
      logger.error('Error generating grouped map activity chart:', error);
      throw error;
    }
  }

  private async createEmptyActivityChart(characterIds: bigint[], groupBy: string, limit: number): Promise<ChartData> {
    logger.warn('No map activity found for the specified characters and time period');

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

  private groupActivitiesByTimeAndCharacter(
    activities: ActivityData[],
    groupBy: string,
    characters: Character[]
  ): Map<string, Map<string, any>> {
    const grouped = new Map<string, Map<string, any>>();

    for (const activity of activities) {
      const timeKey = this.getTimeKey(activity.timestamp, groupBy);

      if (!grouped.has(timeKey)) {
        grouped.set(timeKey, new Map());
      }

      // TypeScript assertion: we just created this map if it didn't exist
      const timeGroup = grouped.get(timeKey) as Map<string, { signatures: number; activities: number }>;

      const character = characters.find(c => BigInt(c.eveId) === activity.characterId);
      if (!character) continue;

      const charKey = character.eveId.toString();

      if (!timeGroup.has(charKey)) {
        timeGroup.set(charKey, {
          signatures: 0,
          activities: 0,
        });
      }

      // Safe to use non-null assertion because we just checked above
      const charData = timeGroup.get(charKey);
      if (charData) {
        charData.signatures += activity.signatures;
        charData.activities += 1;
      }
    }

    return grouped;
  }

  private groupActivitiesByTime(activities: ActivityData[], groupBy: string): Map<string, any> {
    const grouped = new Map<string, any>();

    activities.forEach(activity => {
      const timeKey = this.getTimeKey(activity.timestamp, groupBy);

      if (!grouped.has(timeKey)) {
        grouped.set(timeKey, {
          signatures: 0,
          activities: 0,
        });
      }

      const timeData = grouped.get(timeKey);
      timeData.signatures += activity.signatures;
      timeData.activities += 1;
    });

    return grouped;
  }

  private async createActivityDatasets(
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
      case 'value': // For map activity, value means signatures
        return data.signatures;
      case 'kills': // For map activity, kills means activities
        return data.activities;
      default:
        return data.signatures;
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
}
