import { ChartData } from '../ChartService';
import { IChartDataProvider, ChartGenerationConfig } from '../pipeline/ChartPipeline';
import { RepositoryManager } from '../../../infrastructure/repositories/RepositoryManager';
import { CacheAdapter } from '../../../cache/CacheAdapter';
import { Configuration } from '../../../config';
import { logger } from '../../../lib/logger';

/**
 * Ship data entry format
 */
interface ShipDataEntry {
  shipName: string;
  count: number;
}

/**
 * Data provider for ship usage charts
 * Handles all data generation logic without feature flag complexity
 */
export class ShipUsageDataProvider implements IChartDataProvider {
  constructor(
    private readonly repositoryManager: RepositoryManager,
    private readonly cache: CacheAdapter,
    private readonly useRealData: boolean = true
  ) {}

  async generateChartData(config: ChartGenerationConfig): Promise<ChartData | null> {
    try {
      const { characterId, groupId, days = 30 } = config;

      if (!characterId && !groupId) {
        logger.error('ShipUsageDataProvider: Either characterId or groupId must be provided');
        return null;
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(characterId, groupId, days);
      if (config.cacheEnabled !== false) {
        const cachedData = await this.getCachedData(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }

      // Generate ship data
      const shipData = await this.getShipData(characterId, groupId, days);
      
      // Create chart data
      const chartData = this.createChartData(shipData);

      // Cache the result
      if (config.cacheEnabled !== false) {
        await this.cacheData(cacheKey, chartData, config.cacheTTL);
      }

      return chartData;
    } catch (error) {
      logger.error('ShipUsageDataProvider: Failed to generate chart data', error);
      return null;
    }
  }

  /**
   * Get ship usage data from database or mock data
   */
  private async getShipData(characterId?: string, groupId?: string, days: number = 30): Promise<ShipDataEntry[]> {
    if (!this.useRealData) {
      return this.getMockShipData();
    }

    try {
      logger.info('ShipUsageDataProvider: Using database query for ship usage');

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);

      // Get character IDs
      const characterIds = await this.resolveCharacterIds(characterId, groupId);
      if (characterIds.length === 0) {
        logger.warn('ShipUsageDataProvider: No character IDs resolved');
        return this.getMockShipData();
      }

      // Get top ship types used for kills
      const killRepository = this.repositoryManager.getKillRepository();
      const topShips = await killRepository.getTopShipTypesUsed(
        characterIds.map(id => BigInt(id)),
        startDate,
        endDate,
        Configuration.charts.defaultTopLimit
      );

      const shipData = topShips.map(ship => ({
        shipName: `Ship ${ship.shipTypeId}`, // In real implementation, map to ship names from ESI
        count: ship.count,
      }));

      logger.info(`ShipUsageDataProvider: Found ${shipData.length} ship types`);
      return shipData.length > 0 ? shipData : this.getMockShipData();
    } catch (error) {
      logger.error('ShipUsageDataProvider: Error in database query, falling back to mock data', error);
      return this.getMockShipData();
    }
  }

  /**
   * Resolve character IDs from character or group
   */
  private async resolveCharacterIds(characterId?: string, groupId?: string): Promise<string[]> {
    if (characterId) {
      return [characterId];
    }

    if (groupId) {
      const characterRepository = this.repositoryManager.getCharacterRepository();
      const groups = await characterRepository.getAllCharacterGroups();
      const group = groups.find(g => g.id === groupId);

      if (group?.characters) {
        return group.characters.map((char: any) => char.eveId);
      }
    }

    return [];
  }

  /**
   * Get mock ship data for testing/fallback
   */
  private getMockShipData(): ShipDataEntry[] {
    return [
      { shipName: 'Rifter', count: 15 },
      { shipName: 'Punisher', count: 8 },
      { shipName: 'Merlin', count: 12 },
      { shipName: 'Incursus', count: 5 },
      { shipName: 'Kestrel', count: 10 },
      { shipName: 'Tristan', count: 7 },
    ];
  }

  /**
   * Convert ship data to chart data format
   */
  private createChartData(shipData: ShipDataEntry[]): ChartData {
    return {
      labels: shipData.map(s => s.shipName),
      datasets: [
        {
          label: 'Ship Usage',
          data: shipData.map(s => s.count),
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', 
            '#4BC0C0', '#9966FF', '#FF9F40',
            '#FF6B6B', '#4ECDC4', '#45B7D1',
            '#96CEB4', '#FFEAA7', '#DDA0DD'
          ],
        },
      ],
    };
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(characterId?: string, groupId?: string, days?: number): string {
    const identifier = characterId ? `char-${characterId}` : `group-${groupId}`;
    return `ship-usage-${identifier}-${days}`;
  }

  /**
   * Get cached data
   */
  private async getCachedData(cacheKey: string): Promise<ChartData | null> {
    try {
      const cachedData = await this.cache.get<ChartData>(cacheKey);
      if (cachedData) {
        logger.info(`ShipUsageDataProvider: Retrieved chart from cache: ${cacheKey}`);
        return cachedData;
      }
    } catch (error) {
      logger.warn('ShipUsageDataProvider: Cache retrieval failed', error);
    }
    return null;
  }

  /**
   * Cache data
   */
  private async cacheData(cacheKey: string, chartData: ChartData, ttl?: number): Promise<void> {
    try {
      const cacheTTL = ttl ?? Configuration.charts.defaultCacheTTLSeconds;
      await this.cache.set(cacheKey, chartData, cacheTTL);
      logger.info(`ShipUsageDataProvider: Cached chart data: ${cacheKey}`);
    } catch (error) {
      logger.warn('ShipUsageDataProvider: Cache storage failed', error);
    }
  }
}