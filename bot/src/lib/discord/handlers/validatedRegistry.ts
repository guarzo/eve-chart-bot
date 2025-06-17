import { BaseChartHandler } from './subcommands/BaseChartHandler';
import { ValidatedKillsHandler } from './subcommands/ValidatedKillsHandler';
import { createValidatedHandler } from './subcommands/createValidatedHandler';

// Import existing handlers
import { MapHandler } from './subcommands/MapHandler';
import { LossHandler } from './subcommands/LossHandler';
import { RatioHandler } from './subcommands/RatioHandler';
import { ListHandler } from './subcommands/ListHandler';
import { ShipKillHandler } from './subcommands/ShipKillHandler';
import { ShipLossHandler } from './subcommands/ShipLossHandler';
import { DistributionHandler } from './subcommands/DistributionHandler';
import { CorpsHandler } from './subcommands/CorpsHandler';
import { HeatmapHandler } from './subcommands/HeatmapHandler';
import { EfficiencyHandler } from './subcommands/EfficiencyHandler';

/**
 * Registry for validated chart command handlers
 * Maps subcommand names to handler instances with validation
 */
export class ValidatedChartCommandRegistry {
  private handlers: Map<string, BaseChartHandler> = new Map();

  constructor() {
    this.registerHandlers();
  }

  /**
   * Register all chart command handlers with validation
   */
  private registerHandlers(): void {
    // List command doesn't need validation (no parameters)
    this.handlers.set('list', new ListHandler());

    // Use the fully validated KillsHandler as an example
    this.handlers.set('kills', new ValidatedKillsHandler());

    // Create validated versions of other handlers
    // These use the factory to wrap existing handlers with validation
    this.handlers.set('map', new (createValidatedHandler(MapHandler, 'map'))());
    this.handlers.set('loss', new (createValidatedHandler(LossHandler, 'loss'))());
    this.handlers.set('ratio', new (createValidatedHandler(RatioHandler, 'ratio'))());
    this.handlers.set('shipkill', new (createValidatedHandler(ShipKillHandler, 'shipkill'))());
    this.handlers.set('shiploss', new (createValidatedHandler(ShipLossHandler, 'shiploss'))());
    this.handlers.set('distribution', new (createValidatedHandler(DistributionHandler, 'distribution'))());
    this.handlers.set('corps', new (createValidatedHandler(CorpsHandler, 'corps'))());

    // Heatmap and efficiency are more expensive, use strict rate limits
    this.handlers.set('heatmap', new (createValidatedHandler(HeatmapHandler, 'heatmap', true))());
    this.handlers.set('efficiency', new (createValidatedHandler(EfficiencyHandler, 'efficiency', true))());
  }

  /**
   * Get handler for a specific subcommand
   */
  getHandler(subcommand: string): BaseChartHandler | undefined {
    return this.handlers.get(subcommand);
  }

  /**
   * Get a list of all registered subcommands
   */
  getAvailableSubcommands(): string[] {
    return Array.from(this.handlers.keys());
  }
}
