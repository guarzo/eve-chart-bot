/**
 * Consolidated Chart Factory
 * Single entry point for all chart generation, replacing scattered implementations
 */

import { UnifiedChartService } from '../application/services/UnifiedChartService';
import { IChartService } from '../application/services/IChartService';
import { CanvasChartRenderer } from './rendering/CanvasChartRenderer';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaKillDataRepository } from './repositories/PrismaKillDataRepository';
import { PrismaLossDataRepository } from './repositories/PrismaLossDataRepository';
import { RedisChartCacheRepository } from './repositories/RedisChartCacheRepository';
import { KillDataPoint } from '../domain/services/processors/KillsDataProcessor';
import { LossDataPoint } from '../domain/services/processors/LossDataProcessor';

// Unified data repository implementation
class UnifiedDataRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly killRepo: PrismaKillDataRepository,
    private readonly lossRepo: PrismaLossDataRepository
  ) {}

  async getKillData(characterIds: bigint[], startDate: Date, endDate: Date): Promise<KillDataPoint[]> {
    return this.killRepo.getKillDataForCharacters(characterIds, startDate, endDate);
  }

  async getLossData(characterIds: bigint[], startDate: Date, endDate: Date): Promise<LossDataPoint[]> {
    return this.lossRepo.getLossDataForCharacters(characterIds, startDate, endDate);
  }

  async getGroupLabels(characterIds: bigint[]): Promise<Map<bigint, string>> {
    // Get character groups from database
    const characters = await this.prisma.character.findMany({
      where: {
        eveId: {
          in: characterIds,
        },
      },
      include: {
        characterGroup: true,
      },
    });

    const labelMap = new Map<bigint, string>();
    characters.forEach(char => {
      const label = char.characterGroup?.mapName || char.name;
      labelMap.set(char.eveId, label);
    });

    return labelMap;
  }
}

export class ConsolidatedChartFactory {
  private static instance: ConsolidatedChartFactory;
  private chartService: IChartService | null = null;

  private constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis
  ) {}

  /**
   * Get singleton instance of the factory
   */
  static getInstance(prisma: PrismaClient, redis: Redis): ConsolidatedChartFactory {
    if (!ConsolidatedChartFactory.instance) {
      ConsolidatedChartFactory.instance = new ConsolidatedChartFactory(prisma, redis);
    }
    return ConsolidatedChartFactory.instance;
  }

  /**
   * Get the unified chart service
   */
  getChartService(): IChartService {
    if (!this.chartService) {
      // Create all dependencies
      const killRepo = new PrismaKillDataRepository(this.prisma);
      const lossRepo = new PrismaLossDataRepository(this.prisma);
      const cacheRepo = new RedisChartCacheRepository(this.redis);
      const renderer = new CanvasChartRenderer();

      const dataRepo = new UnifiedDataRepository(this.prisma, killRepo, lossRepo);

      // Create the unified service
      this.chartService = new UnifiedChartService(dataRepo, cacheRepo, renderer);
    }

    return this.chartService;
  }

  /**
   * Get legacy-compatible chart service
   * This maintains backward compatibility with existing code
   */
  getLegacyChartService(): any {
    const chartService = this.getChartService();

    // Return a proxy that adapts the new interface to the old one
    return new Proxy(
      {},
      {
        get: (_target, prop) => {
          // Map old method names to new service
          const methodMap: Record<string, Function> = {
            generateKillsChart: async (options: any) => {
              // Convert legacy options to new configuration
              const config = this.convertLegacyOptions(options, 'kills');
              const result = await chartService.generateChart(config);
              return result.success ? result.data : null;
            },
            generateLossChart: async (options: any) => {
              const config = this.convertLegacyOptions(options, 'losses');
              const result = await chartService.generateChart(config);
              return result.success ? result.data : null;
            },
            generateEfficiencyChart: async (options: any) => {
              const config = this.convertLegacyOptions(options, 'efficiency');
              const result = await chartService.generateChart(config);
              return result.success ? result.data : null;
            },
          };

          return (
            methodMap[prop as string] ||
            (() => {
              throw new Error(`Method ${String(prop)} not implemented in consolidated chart service`);
            })
          );
        },
      }
    );
  }

  /**
   * Convert legacy options to new configuration format
   */
  private convertLegacyOptions(options: any, type: string): any {
    // This would contain the actual conversion logic
    // For now, return a placeholder
    return {
      type,
      characterIds: [],
      startDate: options.startDate,
      endDate: options.endDate,
      displayOptions: {},
    };
  }
}

// Export convenience functions for backward compatibility
export function createChartService(prisma: PrismaClient, redis: Redis): IChartService {
  return ConsolidatedChartFactory.getInstance(prisma, redis).getChartService();
}

export function createLegacyChartService(prisma: PrismaClient, redis: Redis): any {
  return ConsolidatedChartFactory.getInstance(prisma, redis).getLegacyChartService();
}
