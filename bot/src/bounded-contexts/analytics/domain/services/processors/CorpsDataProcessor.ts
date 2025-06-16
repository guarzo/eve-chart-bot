import { ChartData, ChartMetadata } from '../../value-objects/ChartData';
import { ChartConfiguration } from '../../value-objects/ChartConfiguration';
import { IChartDataProcessor } from '../IChartDataProcessor';
import { ChartType } from '../../../../../shared/types/common';

/**
 * Domain service for processing corporation-focused chart data
 * Contains pure business logic for corporation activity analysis
 */
export class CorpsDataProcessor implements IChartDataProcessor {
  
  private createMetadata(dataLength: number): ChartMetadata {
    return new ChartMetadata(new Date(), dataLength, 0, false);
  }
  
  /**
   * Process corporation data based on configuration
   */
  async processData(
    config: ChartConfiguration,
    rawData: any[]
  ): Promise<ChartData> {
    
    const analysisType = config.displayOptions?.analysisType || 'activity';
    
    switch (analysisType) {
      case 'kills':
        return this.processCorpKillsData(rawData, config);
      case 'losses':
        return this.processCorpLossesData(rawData, config);
      case 'efficiency':
        return this.processCorpEfficiencyData(rawData, config);
      case 'enemies':
        return this.processEnemyCorpsData(rawData, config);
      default:
        return this.processCorpActivityData(rawData, config);
    }
  }

  /**
   * Process general corporation activity data
   */
  private processCorpActivityData(
    rawData: any[], 
    config: ChartConfiguration
  ): ChartData {
    
    const corpStats = this.aggregateCorpStats(rawData);
    const sortedCorps = Array.from(corpStats.entries())
      .sort((a, b) => (b[1].kills + b[1].losses) - (a[1].kills + a[1].losses))
      .slice(0, config.displayOptions?.limit || 15);
    
    const labels = sortedCorps.map(([name]) => name);
    const totalActivity = sortedCorps.map(([, stats]) => stats.kills + stats.losses);
    
    return new ChartData(
      ChartType.CORPS_ACTIVITY,
      labels,
      [
        {
          label: 'Total Activity',
          data: totalActivity,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }
      ],
this.createMetadata(totalActivity.length)
    );
  }

  /**
   * Process corporation kills data
   */
  private processCorpKillsData(
    rawData: any[], 
    config: ChartConfiguration
  ): ChartData {
    
    const corpStats = this.aggregateCorpStats(rawData);
    const sortedCorps = Array.from(corpStats.entries())
      .sort((a, b) => b[1].kills - a[1].kills)
      .slice(0, config.displayOptions?.limit || 15);
    
    const labels = sortedCorps.map(([name]) => name);
    const kills = sortedCorps.map(([, stats]) => stats.kills);
    const killValue = sortedCorps.map(([, stats]) => stats.killValue);
    
    const datasets = [
      {
        label: 'Kills',
        data: kills,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }
    ];
    
    // Add value if meaningful
    if (killValue.some(v => v > 0)) {
      datasets.push({
        label: 'Kill Value (ISK)',
        data: killValue,
        backgroundColor: 'rgba(255, 159, 64, 0.6)',
        borderColor: 'rgba(255, 159, 64, 1)',
        borderWidth: 1
      });
    }
    
    return new ChartData(
      ChartType.CORPS_KILLS,
      labels,
      datasets,
this.createMetadata(kills.length)
    );
  }

  /**
   * Process corporation losses data
   */
  private processCorpLossesData(
    rawData: any[], 
    config: ChartConfiguration
  ): ChartData {
    
    const corpStats = this.aggregateCorpStats(rawData);
    const sortedCorps = Array.from(corpStats.entries())
      .sort((a, b) => b[1].losses - a[1].losses)
      .slice(0, config.displayOptions?.limit || 15);
    
    const labels = sortedCorps.map(([name]) => name);
    const losses = sortedCorps.map(([, stats]) => stats.losses);
    const lossValue = sortedCorps.map(([, stats]) => stats.lossValue);
    
    const datasets = [
      {
        label: 'Losses',
        data: losses,
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }
    ];
    
    // Add value if meaningful
    if (lossValue.some(v => v > 0)) {
      datasets.push({
        label: 'Loss Value (ISK)',
        data: lossValue,
        backgroundColor: 'rgba(255, 205, 86, 0.6)',
        borderColor: 'rgba(255, 205, 86, 1)',
        borderWidth: 1
      });
    }
    
    return new ChartData(
      ChartType.CORPS_LOSSES,
      labels,
      datasets,
this.createMetadata(losses.length)
    );
  }

  /**
   * Process corporation efficiency data
   */
  private processCorpEfficiencyData(
    rawData: any[], 
    config: ChartConfiguration
  ): ChartData {
    
    const corpStats = this.aggregateCorpStats(rawData);
    
    // Filter corps with meaningful activity and calculate efficiency
    const corpsWithEfficiency = Array.from(corpStats.entries())
      .map(([name, stats]) => ({
        name,
        ...stats,
        efficiency: this.calculateEfficiency(stats.killValue, stats.lossValue),
        ratio: stats.losses > 0 ? stats.kills / stats.losses : stats.kills
      }))
      .filter(corp => corp.kills + corp.losses >= 3) // Minimum activity threshold
      .sort((a, b) => b.efficiency - a.efficiency)
      .slice(0, config.displayOptions?.limit || 15);
    
    const labels = corpsWithEfficiency.map(corp => corp.name);
    const efficiencies = corpsWithEfficiency.map(corp => corp.efficiency);
    const ratios = corpsWithEfficiency.map(corp => corp.ratio);
    
    return new ChartData(
      ChartType.CORPS_EFFICIENCY,
      labels,
      [
        {
          label: 'Efficiency %',
          data: efficiencies,
          backgroundColor: 'rgba(153, 102, 255, 0.6)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1,
        },
        {
          label: 'K/L Ratio',
          data: ratios,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        }
      ],
this.createMetadata(efficiencies.length)
    );
  }

  /**
   * Process enemy corporations data (most common opponents)
   */
  private processEnemyCorpsData(
    rawData: any[], 
    config: ChartConfiguration
  ): ChartData {
    
    const enemyCorps = new Map<string, number>();
    
    // Count interactions with other corporations
    rawData.forEach(dataPoint => {
      if (dataPoint.enemyCorporation) {
        const corpName = dataPoint.enemyCorporation;
        enemyCorps.set(corpName, (enemyCorps.get(corpName) || 0) + 1);
      }
      
      // Also check attackers for enemy corporations
      if (dataPoint.attackers && Array.isArray(dataPoint.attackers)) {
        dataPoint.attackers.forEach((attacker: any) => {
          if (attacker.corporationName) {
            const corpName = attacker.corporationName;
            enemyCorps.set(corpName, (enemyCorps.get(corpName) || 0) + 1);
          }
        });
      }
    });
    
    const sortedEnemies = Array.from(enemyCorps.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.displayOptions?.limit || 15);
    
    const labels = sortedEnemies.map(([name]) => name);
    const encounters = sortedEnemies.map(([, count]) => count);
    
    return new ChartData(
      ChartType.ENEMY_CORPS,
      labels,
      [
        {
          label: 'Encounters',
          data: encounters,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }
      ],
this.createMetadata(encounters.length)
    );
  }

  /**
   * Aggregate corporation statistics from raw data
   */
  private aggregateCorpStats(rawData: any[]): Map<string, {
    kills: number;
    losses: number;
    killValue: number;
    lossValue: number;
  }> {
    
    const corpStats = new Map<string, {
      kills: number;
      losses: number;
      killValue: number;
      lossValue: number;
    }>();
    
    rawData.forEach(dataPoint => {
      const corpName = dataPoint.corporationName || 
                      dataPoint.victim?.corporationName || 
                      'Unknown Corporation';
      
      if (!corpStats.has(corpName)) {
        corpStats.set(corpName, {
          kills: 0,
          losses: 0,
          killValue: 0,
          lossValue: 0
        });
      }
      
      const stats = corpStats.get(corpName)!;
      
      if (dataPoint.type === 'kill' || dataPoint.isKill) {
        stats.kills++;
        stats.killValue += Number(dataPoint.totalValue || 0);
      } else if (dataPoint.type === 'loss' || dataPoint.isLoss) {
        stats.losses++;
        stats.lossValue += Number(dataPoint.totalValue || 0);
      }
    });
    
    return corpStats;
  }

  /**
   * Calculate efficiency percentage
   */
  private calculateEfficiency(killValue: number, lossValue: number): number {
    const totalValue = killValue + lossValue;
    if (totalValue === 0) {
      return 0;
    }
    return Math.round((killValue / totalValue) * 10000) / 100;
  }

  /**
   * Validate corporation configuration
   */
  validateConfiguration(config: ChartConfiguration): boolean {
    if (!config.startDate || !config.endDate) {
      return false;
    }

    if (config.endDate <= config.startDate) {
      return false;
    }

    // Validate limit is reasonable
    const limit = config.displayOptions?.limit;
    if (limit && (limit < 1 || limit > 50)) {
      return false;
    }

    // Validate analysis type
    const validTypes = ['activity', 'kills', 'losses', 'efficiency', 'enemies'];
    const analysisType = config.displayOptions?.analysisType;
    if (analysisType && !validTypes.includes(analysisType)) {
      return false;
    }

    return true;
  }
}