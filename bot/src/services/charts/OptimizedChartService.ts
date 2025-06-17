import { BaseChartService } from './BaseChartService';
import { getChartWorkerManager } from './workers/ChartWorker';
import { chartCacheService } from './cache/ChartCacheService';
import { ChartData, ChartOptions, ChartMetric } from '../../types/chart';
import { logger } from '../../lib/logger';
import { Character } from '../../domain/character/Character';

interface ProcessingMetrics {
  startTime: number;
  cacheHits: number;
  cacheMisses: number;
  dbQueries: number;
  processingTime: number;
  renderingTime: number;
}

export class OptimizedChartService extends BaseChartService {
  private readonly batchSize = parseInt(process.env.CHART_BATCH_SIZE || '100');
  private readonly maxConcurrentQueries = parseInt(process.env.CHART_MAX_CONCURRENT_QUERIES || '5');

  async generateOptimizedKillsChart(
    characterIds: string[],
    startDate: Date,
    groupBy: string,
    displayMetric: ChartMetric,
    limit: number,
    options: ChartOptions = {}
  ): Promise<Buffer> {
    const metrics: ProcessingMetrics = {
      startTime: Date.now(),
      cacheHits: 0,
      cacheMisses: 0,
      dbQueries: 0,
      processingTime: 0,
      renderingTime: 0,
    };

    try {
      // Generate cache key for the complete chart result
      const cacheKey = {
        characterIds,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        groupBy,
        displayMetric,
        options: chartCacheService.generateOptionsHash(options),
      };

      // Try to get cached chart result first
      const cachedResult = await chartCacheService.getCachedChartResult(cacheKey);
      if (cachedResult) {
        metrics.cacheHits++;
        logger.info(`Chart cache hit - returning cached result in ${Date.now() - metrics.startTime}ms`);
        return cachedResult;
      }

      metrics.cacheMisses++;

      // Check for cached chart data
      let chartData = await chartCacheService.getCachedChartData(cacheKey);
      
      if (!chartData) {
        // Generate chart data with optimizations
        chartData = await this.generateOptimizedChartData(
          characterIds,
          startDate,
          groupBy,
          displayMetric,
          limit,
          metrics
        );

        // Cache the generated data
        await chartCacheService.setCachedChartData(cacheKey, chartData);
      } else {
        metrics.cacheHits++;
        logger.debug('Chart data cache hit');
      }

      metrics.processingTime = Date.now() - metrics.startTime;

      // Render chart using worker thread
      const renderStart = Date.now();
      const chartBuffer = await getChartWorkerManager().renderChart(chartData, options);
      metrics.renderingTime = Date.now() - renderStart;

      // Cache the rendered result
      await chartCacheService.setCachedChartResult(cacheKey, chartBuffer);

      const totalTime = Date.now() - metrics.startTime;
      logger.info(`Chart generation completed: ${totalTime}ms total, ${metrics.processingTime}ms processing, ${metrics.renderingTime}ms rendering`);
      logger.debug('Chart metrics:', metrics);

      return chartBuffer;
    } catch (error) {
      logger.error('Error in optimized chart generation:', error);
      throw error;
    }
  }

  private async generateOptimizedChartData(
    characterIds: string[],
    startDate: Date,
    groupBy: string,
    displayMetric: ChartMetric,
    limit: number,
    metrics: ProcessingMetrics
  ): Promise<ChartData> {
    const characterIdsBigInt = characterIds.map(id => BigInt(id));

    // Batch character group lookups
    const allCharacters = await this.getExpandedCharactersBatched(characterIds, metrics);
    const allCharacterIds = allCharacters.map((c: Character) => c.eveId);

    logger.info(`Processing chart for ${allCharacters.length} characters (expanded from ${characterIds.length})`);

    // Get kills with caching
    const kills = await this.getKillsWithCaching(allCharacterIds.map(id => BigInt(id)), startDate, new Date(), metrics);

    if (kills.length === 0) {
      return this.createEmptyKillsChart(characterIdsBigInt, groupBy, limit, allCharacters);
    }

    // Process data with streaming approach for large datasets
    const groupedData = await this.streamProcessKillsData(kills, groupBy, allCharacters, metrics);

    // Generate datasets efficiently
    const datasets = await this.createOptimizedDatasets(groupedData, characterIdsBigInt, displayMetric, limit, allCharacters);

    // Generate time labels
    const labels = this.generateTimeLabels(startDate, new Date(), groupBy);

    return {
      labels,
      datasets,
      title: this.generateChartTitle('kills', displayMetric, this.periodFromDates(startDate)),
      displayType: 'line',
    };
  }

  private async getExpandedCharactersBatched(characterIds: string[], metrics: ProcessingMetrics): Promise<Character[]> {
    const cacheKey = chartCacheService.generateAggregationKey({
      type: 'expanded_characters',
      characterIds,
    });

    const cached = await chartCacheService.getCachedAggregatedData<Character[]>(cacheKey);
    if (cached) {
      metrics.cacheHits++;
      return cached;
    }

    metrics.cacheMisses++;

    // Process in batches to avoid overwhelming the database
    const batches = this.chunkArray(characterIds, this.batchSize);
    const allCharactersBatched: Character[][] = [];

    // Limit concurrent operations
    for (let i = 0; i < batches.length; i += this.maxConcurrentQueries) {
      const batchSlice = batches.slice(i, i + this.maxConcurrentQueries);
      
      const batchResults = await Promise.all(
        batchSlice.map(async (batch) => {
          metrics.dbQueries++;
          const charactersNested = await Promise.all(
            batch.map(async (id: string) => {
              const character = await this.characterRepository.getCharacter(BigInt(id));
              if (character?.characterGroupId) {
                return this.characterRepository.getCharactersByGroup(character.characterGroupId);
              }
              return character ? [character] : [];
            })
          );
          return charactersNested.flat();
        })
      );

      allCharactersBatched.push(...batchResults);
    }

    const allCharacters = allCharactersBatched.flat();
    
    // Remove duplicates
    const uniqueCharacters = allCharacters.filter((char, index, self) => 
      index === self.findIndex(c => c.eveId === char.eveId)
    );

    await chartCacheService.setCachedAggregatedData(cacheKey, uniqueCharacters);
    
    return uniqueCharacters;
  }

  private async getKillsWithCaching(
    characterIds: bigint[],
    startDate: Date,
    endDate: Date,
    metrics: ProcessingMetrics
  ): Promise<any[]> {
    const queryKey = chartCacheService.generateDbQueryKey({
      operation: 'getKillsForCharacters',
      characterIds,
      startDate,
      endDate,
    });

    const cached = await chartCacheService.getCachedDbQuery<any[]>(queryKey);
    if (cached) {
      metrics.cacheHits++;
      return cached;
    }

    metrics.cacheMisses++;
    metrics.dbQueries++;

    const kills = await this.killRepository.getKillsForCharacters(characterIds, startDate, endDate);
    await chartCacheService.setCachedDbQuery(queryKey, kills);

    return kills;
  }

  private async streamProcessKillsData(
    kills: any[],
    groupBy: string,
    characters: Character[],
    metrics: ProcessingMetrics
  ): Promise<Map<string, Map<string, any>>> {
    const cacheKey = chartCacheService.generateAggregationKey({
      type: 'grouped_kills',
      characterIds: characters.map(c => c.eveId.toString()),
      groupBy,
      additionalParams: { killCount: kills.length },
    });

    const cached = await chartCacheService.getCachedAggregatedData<Map<string, Map<string, any>>>(cacheKey);
    if (cached) {
      metrics.cacheHits++;
      // Convert plain objects back to Maps
      return new Map(Object.entries(cached).map(([key, value]) => [key, new Map(Object.entries(value))]));
    }

    metrics.cacheMisses++;

    const grouped = new Map<string, Map<string, any>>();
    const characterMap = new Map(characters.map(c => [c.eveId.toString(), c]));

    // Process kills in chunks to avoid blocking event loop
    const chunkSize = 1000;
    for (let i = 0; i < kills.length; i += chunkSize) {
      const chunk = kills.slice(i, i + chunkSize);
      
      for (const kill of chunk) {
        const killData = {
          killTime: new Date(kill.kill_time),
          totalValue: BigInt(kill.total_value),
          points: kill.points,
          attackerCount: kill.attackers?.length ?? 0,
          characters: kill.characters?.map((char: any) => ({
            characterId: BigInt(char.character_id),
          })) ?? [],
        };

        const timeKey = this.getTimeKey(killData.killTime, groupBy);

        if (!grouped.has(timeKey)) {
          grouped.set(timeKey, new Map());
        }

        const timeGroup = grouped.get(timeKey)!;

        for (const killChar of killData.characters) {
          const character = characterMap.get(killChar.characterId.toString());
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

          const charData = timeGroup.get(charKey)!;
          charData.kills += 1;
          charData.totalValue += killData.totalValue;
          charData.points += killData.points;
          charData.attackers += killData.attackerCount;
        }
      }

      // Yield control to event loop periodically
      if (i % (chunkSize * 5) === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    // Convert Maps to plain objects for caching
    const cacheData = Object.fromEntries(
      Array.from(grouped.entries()).map(([key, value]) => [
        key,
        Object.fromEntries(value.entries())
      ])
    );

    await chartCacheService.setCachedAggregatedData(cacheKey, cacheData);

    return grouped;
  }

  private async createOptimizedDatasets(
    groupedData: Map<string, Map<string, any>>,
    characterIds: bigint[],
    displayMetric: ChartMetric,
    limit: number,
    allCharacters: Character[]
  ): Promise<any[]> {
    const limitedCharacterIds = characterIds.slice(0, limit);
    const characterMap = new Map(allCharacters.map(c => [c.eveId.toString(), c]));

    // Process datasets in parallel but limit concurrency
    const results: any[] = [];
    
    for (let i = 0; i < limitedCharacterIds.length; i += this.maxConcurrentQueries) {
      const batch = limitedCharacterIds.slice(i, i + this.maxConcurrentQueries);
      
      const batchResults = await Promise.all(
        batch.map(async (characterId, batchIndex) => {
          const character = characterMap.get(characterId.toString());
          const charKey = characterId.toString();
          const globalIndex = i + batchIndex;

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
            borderColor: this.getColor(globalIndex),
            fill: false,
          };
        })
      );

      results.push(...batchResults);
    }

    return results;
  }

  private createEmptyKillsChart(
    characterIds: bigint[],
    groupBy: string,
    limit: number,
    characters: Character[]
  ): ChartData {
    const characterMap = new Map(characters.map(c => [c.eveId.toString(), c]));
    
    const emptyDatasets = characterIds.slice(0, limit).map((characterId, index) => {
      const character = characterMap.get(characterId.toString());
      return {
        label: character?.name ?? `Character ${characterId}`,
        data: [],
        borderColor: this.getColor(index),
        fill: false,
      };
    });

    const labels = this.generateEmptyTimeLabels(groupBy);

    return {
      labels,
      datasets: emptyDatasets,
      title: '',
      displayType: 'line',
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
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
        return date.toISOString().substring(0, 13) + ':00:00.000Z';
      case 'day':
        return date.toISOString().substring(0, 10);
      case 'week': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().substring(0, 10);
      }
      default:
        return date.toISOString().substring(0, 10);
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
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      case 'day':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'week':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      default:
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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