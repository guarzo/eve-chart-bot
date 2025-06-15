import { BaseRepository } from '../../infrastructure/repositories/BaseRepository';
import { CharacterRepository } from '../../infrastructure/repositories/CharacterRepository';
import { KillRepository } from '../../infrastructure/repositories/KillRepository';
import { MapActivityRepository } from '../../infrastructure/repositories/MapActivityRepository';
import { Character } from '../../domain/character/Character';
import { CharacterGroup } from '../../domain/character/CharacterGroup';
import { PrismaClient } from '@prisma/client';
import { errorHandler, ChartError, ValidationError } from '../../shared/errors';
import { logger } from '../../lib/logger';

export abstract class BaseChartService extends BaseRepository {
  protected readonly characterRepository: CharacterRepository;
  protected readonly killRepository: KillRepository;
  protected readonly mapActivityRepository: MapActivityRepository;

  protected colors: string[] = [
    '#3366CC', // deep blue
    '#DC3912', // red
    '#FF9900', // orange
    '#109618', // green
    '#990099', // purple
    '#0099C6', // teal
    '#DD4477', // pink
    '#66AA00', // lime
    '#B82E2E', // dark red
    '#316395', // navy
    '#994499', // violet
    '#22AA99', // seafoam
    '#6633CC', // blue violet
    '#E67300', // dark orange
    '#8B0707', // dark red
    '#651067', // dark purple
    '#329262', // forest green
    '#5574A6', // steel blue
    '#3B3EAC', // royal blue
    '#B77322', // brownish orange
  ];

  constructor(prisma: PrismaClient) {
    super('ChartService'); // BaseRepository expects a model name string
    this.characterRepository = new CharacterRepository(prisma);
    this.killRepository = new KillRepository(prisma);
    this.mapActivityRepository = new MapActivityRepository();
  }

  protected calculateStartDate(period: string): Date {
    const startDate = new Date();
    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        throw new Error(`Invalid period: ${period}`);
    }
    return startDate;
  }

  protected generateChartTitle(type: string, displayMetric: string, period: string): string {
    const metricLabel =
      displayMetric === 'value'
        ? 'ISK Value'
        : displayMetric === 'kills'
          ? 'Kill Count'
          : displayMetric === 'points'
            ? 'Points'
            : 'Attacker Count';

    return `${type === 'kills' ? 'Kills' : 'Map Activity'} - ${metricLabel} - Last ${
      period === '24h' ? '24 Hours' : period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'
    }`;
  }

  protected getColor(index: number): string {
    return this.colors[index % this.colors.length];
  }

  async getTrackedCharacters(): Promise<Array<{ id: string; name: string; active: boolean }>> {
    const characters = await this.characterRepository.getAllCharacters();
    return characters.map(char => ({
      id: char.eveId.toString(),
      name: char.name,
      active: true, // Assume all tracked characters are active
    }));
  }

  async getCharacterGroups(): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      active: boolean;
      characters: Array<{ id: string; name: string }>;
    }>
  > {
    const groups = await this.characterRepository.getAllCharacterGroups();
    return groups.map(group => ({
      id: group.id,
      name: group.name,
      description: group.name, // Use name as description since description property doesn't exist
      active: true, // Assume all groups are active
      characters:
        group.characters?.map(char => ({
          id: char.eveId.toString(),
          name: char.name,
        })) || [],
    }));
  }

  async getAllCharacterGroups(): Promise<CharacterGroup[]> {
    return this.characterRepository.getAllCharacterGroups();
  }

  async getCharacterGroup(groupId: string): Promise<CharacterGroup | null> {
    return this.characterRepository.getCharacterGroup(groupId);
  }

  async getAllCharacters(): Promise<Character[]> {
    return this.characterRepository.getAllCharacters();
  }

  async getCharactersByGroup(groupId: string): Promise<Character[]> {
    return this.characterRepository.getCharactersByGroup(groupId);
  }
}
