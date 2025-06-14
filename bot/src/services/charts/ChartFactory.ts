import { BaseChartGenerator } from './BaseChartGenerator';
import {
  KillsChartGenerator,
  MapChartGenerator,
  LossChartGenerator,
  RatioChartGenerator,
  ShipTypesChartGenerator,
  DistributionChartGenerator,
  CorpsChartGenerator,
  TrendChartGenerator,
  HeatmapChartGenerator,
} from './generators';
import { ShipKillChartGenerator } from './generators/ShipKillChartGenerator';
import { ShipLossChartGenerator } from './generators/ShipLossChartGenerator';
import { EfficiencyChartGenerator } from './generators/EfficiencyChartGenerator';
import { logger } from '../../lib/logger';
import { RepositoryManager } from '../../infrastructure/repositories/RepositoryManager';
import { chartPalette } from './config/theme';

/**
 * Factory for creating chart generators
 */
export class ChartFactory {
  // Default color palette for all charts
  private static defaultColors = chartPalette;

  // Chart type specific color palettes
  private static chartTypeColors: Record<string, string[]> = {
    kills: ['#3366CC', '#7799DD', '#112266'],
    loss: ['#DC3912', '#FF6644', '#991100'],
    ratio: ['#FF9900', '#FFBB55', '#CC6600'],
    heatmap: ['#0099C6', '#5EBBDD', '#006688'],
  };

  private static generators: Map<
    string,
    new (repoManager: RepositoryManager, colors?: string[]) => BaseChartGenerator
  > = new Map();

  static {
    // Register chart generators
    this.generators.set('kills', KillsChartGenerator);
    this.generators.set('map', MapChartGenerator);
    this.generators.set('loss', LossChartGenerator);
    this.generators.set('ratio', RatioChartGenerator);
    this.generators.set('shiptypes', ShipTypesChartGenerator);
    this.generators.set('shipkill', ShipKillChartGenerator);
    this.generators.set('shiploss', ShipLossChartGenerator);
    this.generators.set('distribution', DistributionChartGenerator);
    this.generators.set('corps', CorpsChartGenerator);
    this.generators.set('trend', TrendChartGenerator);
    this.generators.set('heatmap', HeatmapChartGenerator);
    this.generators.set('efficiency', EfficiencyChartGenerator);
  }

  /**
   * Get colors for a specific chart type, or fall back to default palette
   */
  private static getColorsForChartType(type: string): string[] {
    return this.chartTypeColors[type] || this.defaultColors;
  }

  /**
   * Get a chart generator based on chart type
   */
  public static createGenerator(type: string): BaseChartGenerator {
    const GeneratorClass = this.generators.get(type);

    if (!GeneratorClass) {
      logger.error(`Unknown chart type: ${type}`);
      throw new Error(`Unknown chart type: ${type}`);
    }

    const repositoryManager = new RepositoryManager();
    const colors = this.getColorsForChartType(type);
    return new GeneratorClass(repositoryManager, colors);
  }

  /**
   * Get a list of all available chart types
   */
  public static getAvailableChartTypes(): string[] {
    return Array.from(this.generators.keys());
  }
}
