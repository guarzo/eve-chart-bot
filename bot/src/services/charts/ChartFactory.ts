import { BaseChartGenerator } from "./BaseChartGenerator";
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
} from "./generators";
import { logger } from "../../lib/logger";

/**
 * Factory for creating chart generators
 */
export class ChartFactory {
  private generators: Map<string, new () => BaseChartGenerator> = new Map();

  constructor() {
    this.registerGenerators();
  }

  /**
   * Register available chart generators
   */
  private registerGenerators(): void {
    this.generators.set("kills", KillsChartGenerator);
    this.generators.set("map_activity", MapChartGenerator);

    // Uncommented implementations for Phase 4
    this.generators.set("loss", LossChartGenerator);
    this.generators.set("ratio", RatioChartGenerator);

    // Phase 2: Ship Type Analysis
    this.generators.set("shiptypes", ShipTypesChartGenerator);

    // Phase 3: Distribution and Enemy Analysis
    this.generators.set("distribution", DistributionChartGenerator);
    this.generators.set("corps", CorpsChartGenerator);

    // Phase 4: Time-Based Analysis
    this.generators.set("trend", TrendChartGenerator);
    this.generators.set("heatmap", HeatmapChartGenerator);
  }

  /**
   * Get a chart generator based on chart type
   */
  public getGenerator(chartType: string): BaseChartGenerator {
    const GeneratorClass = this.generators.get(chartType);

    if (!GeneratorClass) {
      logger.error(`Unknown chart type: ${chartType}`);
      throw new Error(`Unknown chart type: ${chartType}`);
    }

    return new GeneratorClass();
  }

  /**
   * Get a list of all available chart types
   */
  public getAvailableChartTypes(): string[] {
    return Array.from(this.generators.keys());
  }
}
