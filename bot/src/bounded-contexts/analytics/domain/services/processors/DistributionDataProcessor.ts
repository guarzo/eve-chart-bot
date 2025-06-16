import { ChartData, ChartMetadata } from '../../value-objects/ChartData';
import { ChartConfiguration } from '../../value-objects/ChartConfiguration';
import { IChartDataProcessor } from '../IChartDataProcessor';
import { ChartType } from '../../../../../shared/types/common';

/**
 * Domain service for processing distribution chart data
 * Contains pure business logic for activity distribution analysis
 */
export class DistributionDataProcessor implements IChartDataProcessor {
  
  private createMetadata(dataLength: number): ChartMetadata {
    return new ChartMetadata(new Date(), dataLength, 0, false);
  }
  
  /**
   * Process distribution data based on configuration
   */
  async processData(
    config: ChartConfiguration,
    rawData: any[]
  ): Promise<ChartData> {
    
    const distributionType = config.displayOptions?.distributionType || 'system';
    
    switch (distributionType) {
      case 'system':
        return this.processSystemDistribution(rawData, config);
      case 'region':
        return this.processRegionDistribution(rawData, config);
      case 'shipClass':
        return this.processShipClassDistribution(rawData, config);
      case 'corporation':
        return this.processCorporationDistribution(rawData, config);
      default:
        return this.processSystemDistribution(rawData, config);
    }
  }

  /**
   * Process distribution by solar system
   */
  private processSystemDistribution(
    rawData: any[], 
    config: ChartConfiguration
  ): ChartData {
    
    const systemMap = new Map<string, { count: number; value: number }>();
    
    rawData.forEach(dataPoint => {
      const systemName = dataPoint.systemName || dataPoint.solarSystemName || 'Unknown';
      
      if (!systemMap.has(systemName)) {
        systemMap.set(systemName, { count: 0, value: 0 });
      }
      
      const stats = systemMap.get(systemName)!;
      stats.count++;
      stats.value += Number(dataPoint.totalValue || 0);
    });
    
    return this.formatDistributionData(
      systemMap,
      config,
      'Activity Distribution by Solar System'
    );
  }

  /**
   * Process distribution by region
   */
  private processRegionDistribution(
    rawData: any[], 
    config: ChartConfiguration
  ): ChartData {
    
    const regionMap = new Map<string, { count: number; value: number }>();
    
    rawData.forEach(dataPoint => {
      const regionName = dataPoint.regionName || 'Unknown';
      
      if (!regionMap.has(regionName)) {
        regionMap.set(regionName, { count: 0, value: 0 });
      }
      
      const stats = regionMap.get(regionName)!;
      stats.count++;
      stats.value += Number(dataPoint.totalValue || 0);
    });
    
    return this.formatDistributionData(
      regionMap,
      config,
      'Activity Distribution by Region'
    );
  }

  /**
   * Process distribution by ship class
   */
  private processShipClassDistribution(
    rawData: any[], 
    config: ChartConfiguration
  ): ChartData {
    
    const shipClassMap = new Map<string, { count: number; value: number }>();
    
    rawData.forEach(dataPoint => {
      // Extract ship class from ship type or category
      const shipClass = this.determineShipClass(dataPoint);
      
      if (!shipClassMap.has(shipClass)) {
        shipClassMap.set(shipClass, { count: 0, value: 0 });
      }
      
      const stats = shipClassMap.get(shipClass)!;
      stats.count++;
      stats.value += Number(dataPoint.totalValue || 0);
    });
    
    return this.formatDistributionData(
      shipClassMap,
      config,
      'Activity Distribution by Ship Class'
    );
  }

  /**
   * Process distribution by corporation
   */
  private processCorporationDistribution(
    rawData: any[], 
    config: ChartConfiguration
  ): ChartData {
    
    const corpMap = new Map<string, { count: number; value: number }>();
    
    rawData.forEach(dataPoint => {
      const corpName = dataPoint.corporationName || 
                      dataPoint.victim?.corporationName || 
                      'Unknown';
      
      if (!corpMap.has(corpName)) {
        corpMap.set(corpName, { count: 0, value: 0 });
      }
      
      const stats = corpMap.get(corpName)!;
      stats.count++;
      stats.value += Number(dataPoint.totalValue || 0);
    });
    
    return this.formatDistributionData(
      corpMap,
      config,
      'Activity Distribution by Corporation'
    );
  }

  /**
   * Determine ship class from data point
   */
  private determineShipClass(dataPoint: any): string {
    // Try to extract ship class from various possible fields
    if (dataPoint.shipClass) {
      return dataPoint.shipClass;
    }
    
    if (dataPoint.shipTypeName) {
      return this.classifyShipByName(dataPoint.shipTypeName);
    }
    
    if (dataPoint.victim?.shipTypeName) {
      return this.classifyShipByName(dataPoint.victim.shipTypeName);
    }
    
    return 'Unknown';
  }

  /**
   * Classify ship by name patterns (basic classification)
   */
  private classifyShipByName(shipName: string): string {
    const name = shipName.toLowerCase();
    
    // Basic ship classification patterns
    if (name.includes('frigate') || name.includes('interceptor') || name.includes('assault')) {
      return 'Frigate';
    }
    if (name.includes('destroyer') || name.includes('interdictor')) {
      return 'Destroyer';
    }
    if (name.includes('cruiser') || name.includes('recon') || name.includes('logistics')) {
      return 'Cruiser';
    }
    if (name.includes('battlecruiser')) {
      return 'Battlecruiser';
    }
    if (name.includes('battleship') || name.includes('dreadnought') || name.includes('marauder')) {
      return 'Battleship';
    }
    if (name.includes('carrier') || name.includes('dreadnought') || name.includes('supercarrier') || name.includes('titan')) {
      return 'Capital';
    }
    if (name.includes('industrial') || name.includes('mining') || name.includes('hauler')) {
      return 'Industrial';
    }
    if (name.includes('shuttle') || name.includes('pod')) {
      return 'Capsule/Shuttle';
    }
    
    return 'Other';
  }

  /**
   * Format distribution data for chart display
   */
  private formatDistributionData(
    distributionMap: Map<string, { count: number; value: number }>,
    config: ChartConfiguration,
_title: string
  ): ChartData {
    
    // Sort by count and take top entries
    const limit = config.displayOptions?.limit || 10;
    const sortedEntries = Array.from(distributionMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit);
    
    const labels = sortedEntries.map(([name]) => name);
    const counts = sortedEntries.map(([, stats]) => stats.count);
    const values = sortedEntries.map(([, stats]) => stats.value);
    
    
    const datasets = [
      {
        label: 'Activity Count',
        data: counts,
        backgroundColor: this.generateDistributionColors(counts.length),
        borderWidth: 1
      }
    ];
    
    // Add value dataset if meaningful
    const hasValues = values.some(v => v > 0);
    if (hasValues) {
      datasets.push({
        label: 'Total Value (ISK)',
        data: values,
        backgroundColor: this.generateDistributionColors(values.length, 0.3),
        borderWidth: 1
      });
    }
    
    return new ChartData(
      ChartType.DISTRIBUTION,
      labels,
      datasets,
this.createMetadata(counts.length)
    );
  }

  /**
   * Generate colors for distribution chart
   */
  private generateDistributionColors(count: number, alpha: number = 0.8): string[] {
    const colors = [];
    const hueStep = 360 / count;
    
    for (let i = 0; i < count; i++) {
      const hue = i * hueStep;
      colors.push(`hsla(${hue}, 70%, 60%, ${alpha})`);
    }
    
    return colors;
  }


  /**
   * Validate distribution configuration
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

    // Validate distribution type
    const validTypes = ['system', 'region', 'shipClass', 'corporation'];
    const distributionType = config.displayOptions?.distributionType;
    if (distributionType && !validTypes.includes(distributionType)) {
      return false;
    }

    return true;
  }
}