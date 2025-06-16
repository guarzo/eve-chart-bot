import { ChartData, ChartMetadata } from '../../value-objects/ChartData';
import { ChartConfiguration } from '../../value-objects/ChartConfiguration';
import { IChartDataProcessor } from '../IChartDataProcessor';
import { ChartType } from '../../../../../shared/types/common';

/**
 * Domain service for processing ship types chart data
 * Contains pure business logic for ship type analysis
 */
export class ShipTypesDataProcessor implements IChartDataProcessor {
  
  private createMetadata(dataLength: number): ChartMetadata {
    return new ChartMetadata(new Date(), dataLength, 0, false);
  }
  
  /**
   * Process ship types data based on configuration
   */
  async processData(
    config: ChartConfiguration,
    rawData: any[]
  ): Promise<ChartData> {
    
    // Determine analysis type based on configuration
    if (config.displayOptions?.analysisType === 'destroyed') {
      return this.processShipTypesDestroyed(rawData, config);
    } else {
      return this.processShipTypesUsed(rawData, config);
    }
  }

  /**
   * Process ship types used in attacks
   */
  private processShipTypesUsed(
    rawData: any[], 
    config: ChartConfiguration
  ): ChartData {
    
    const shipTypeMap = new Map<string, number>();
    
    // Process attacker data
    rawData.forEach(kill => {
      if (kill.attackers && Array.isArray(kill.attackers)) {
        kill.attackers.forEach((attacker: any) => {
          if (attacker.shipTypeName) {
            const shipType = attacker.shipTypeName;
            const currentCount = shipTypeMap.get(shipType) || 0;
            shipTypeMap.set(shipType, currentCount + 1);
          }
        });
      }
    });
    
    return this.formatShipTypeData(shipTypeMap, config, 'Ship Types Used in Combat');
  }

  /**
   * Process ship types that were destroyed
   */
  private processShipTypesDestroyed(
    rawData: any[], 
    config: ChartConfiguration
  ): ChartData {
    
    const shipTypeMap = new Map<string, number>();
    
    // Process victim data
    rawData.forEach(kill => {
      if (kill.victim && kill.victim.shipTypeName) {
        const shipType = kill.victim.shipTypeName;
        const currentCount = shipTypeMap.get(shipType) || 0;
        shipTypeMap.set(shipType, currentCount + 1);
      }
    });
    
    return this.formatShipTypeData(shipTypeMap, config, 'Ship Types Destroyed');
  }

  /**
   * Format ship type data for chart display
   */
  private formatShipTypeData(
    shipTypeMap: Map<string, number>,
    config: ChartConfiguration,
_title: string
  ): ChartData {
    
    // Sort by count and take top entries
    const limit = config.displayOptions?.limit || 15;
    const sortedEntries = Array.from(shipTypeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    
    const labels = sortedEntries.map(entry => entry[0]);
    const data = sortedEntries.map(entry => entry[1]);
    
    // Generate colors for each ship type
    const colors = this.generateShipTypeColors(data.length);
    
    return new ChartData(
      ChartType.SHIP_TYPES,
      labels,
      [
        {
          label: 'Count',
          data,
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: 1
        }
      ],
this.createMetadata(data.length)
    );
  }

  /**
   * Generate color scheme for ship types
   */
  private generateShipTypeColors(count: number): { background: string[], border: string[] } {
    const baseColors = [
      'rgba(255, 99, 132, 0.8)',   // Red
      'rgba(54, 162, 235, 0.8)',   // Blue  
      'rgba(255, 205, 86, 0.8)',   // Yellow
      'rgba(75, 192, 192, 0.8)',   // Teal
      'rgba(153, 102, 255, 0.8)',  // Purple
      'rgba(255, 159, 64, 0.8)',   // Orange
      'rgba(199, 199, 199, 0.8)',  // Gray
      'rgba(83, 102, 255, 0.8)',   // Blue-Purple
      'rgba(255, 99, 255, 0.8)',   // Pink
      'rgba(99, 255, 132, 0.8)'    // Green
    ];

    const borderColors = baseColors.map(color => color.replace('0.8', '1.0'));
    
    const background: string[] = [];
    const border: string[] = [];
    
    for (let i = 0; i < count; i++) {
      background.push(baseColors[i % baseColors.length]);
      border.push(borderColors[i % borderColors.length]);
    }
    
    return { background, border };
  }


  /**
   * Validate ship types configuration
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

    return true;
  }
}