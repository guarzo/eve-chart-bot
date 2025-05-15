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
import { MapActivityRepository } from "../../data/repositories/MapActivityRepository";

/**
 * Factory for creating chart generators
 */
export class ChartFactory {
  private static generators: Map<
    string,
    new (...args: any[]) => BaseChartGenerator
  > = new Map();

  static {
    // Register chart generators
    this.generators.set("kills", KillsChartGenerator);
    this.generators.set("map", MapChartGenerator);

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
  public static createGenerator(type: string): BaseChartGenerator {
    const GeneratorClass = this.generators.get(type);

    if (!GeneratorClass) {
      logger.error(`Unknown chart type: ${type}`);
      throw new Error(`Unknown chart type: ${type}`);
    }

    // Special case for MapChartGenerator which requires a repository
    if (type === "map") {
      return new MapChartGenerator(new MapActivityRepository());
    }

    return new GeneratorClass();
  }

  /**
   * Get a list of all available chart types
   */
  public static getAvailableChartTypes(): string[] {
    return Array.from(this.generators.keys());
  }
}
