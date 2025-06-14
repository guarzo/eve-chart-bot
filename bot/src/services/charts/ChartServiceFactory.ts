import { PrismaClient } from '@prisma/client';
import { IChartService } from './interfaces/IChartService';
import { IKillsChartService } from './interfaces/IKillsChartService';
import { IMapActivityChartService } from './interfaces/IMapActivityChartService';
import { MainChartService } from './implementations/MainChartService';
import { KillsChartService } from './implementations/KillsChartService';
import { MapActivityChartService } from './implementations/MapActivityChartService';

export class ChartServiceFactory {
  private static instance: ChartServiceFactory;
  private mainChartService: MainChartService | null = null;
  private killsChartService: KillsChartService | null = null;
  private mapActivityChartService: MapActivityChartService | null = null;

  private constructor(private readonly prisma: PrismaClient) {}

  static getInstance(prisma: PrismaClient): ChartServiceFactory {
    if (!ChartServiceFactory.instance) {
      ChartServiceFactory.instance = new ChartServiceFactory(prisma);
    }
    return ChartServiceFactory.instance;
  }

  getMainChartService(): IChartService {
    if (!this.mainChartService) {
      this.mainChartService = new MainChartService(this.prisma);
    }
    return this.mainChartService;
  }

  getKillsChartService(): IKillsChartService {
    if (!this.killsChartService) {
      this.killsChartService = new KillsChartService(this.prisma);
    }
    return this.killsChartService;
  }

  getMapActivityChartService(): IMapActivityChartService {
    if (!this.mapActivityChartService) {
      this.mapActivityChartService = new MapActivityChartService(this.prisma);
    }
    return this.mapActivityChartService;
  }
}
