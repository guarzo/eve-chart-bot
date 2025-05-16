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
import { ShipKillChartGenerator } from "./generators/ShipKillChartGenerator";
import { ShipLossChartGenerator } from "./generators/ShipLossChartGenerator";
import { EfficiencyChartGenerator } from "./generators/EfficiencyChartGenerator";
import { logger } from "../../lib/logger";

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
    this.generators.set("loss", LossChartGenerator);
    this.generators.set("ratio", RatioChartGenerator);
    this.generators.set("shiptypes", ShipTypesChartGenerator);
    this.generators.set("shipkill", ShipKillChartGenerator);
    this.generators.set("shiploss", ShipLossChartGenerator);
    this.generators.set("distribution", DistributionChartGenerator);
    this.generators.set("corps", CorpsChartGenerator);
    this.generators.set("trend", TrendChartGenerator);
    this.generators.set("heatmap", HeatmapChartGenerator);
    this.generators.set("efficiency", EfficiencyChartGenerator);
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

    return new GeneratorClass();
  }

  /**
   * Get a list of all available chart types
   */
  public static getAvailableChartTypes(): string[] {
    return Array.from(this.generators.keys());
  }
}
