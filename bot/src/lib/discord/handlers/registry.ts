import { BaseChartHandler } from './subcommands/BaseChartHandler';
import { KillsHandler } from './subcommands/KillsHandler';
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
 * Registry for chart command handlers
 * Maps subcommand names to handler instances
 */
export class ChartCommandRegistry {
  private handlers: Map<string, BaseChartHandler> = new Map();

  constructor() {
    this.registerHandlers();
  }

  /**
   * Register all chart command handlers
   */
  private registerHandlers(): void {
    this.handlers.set('list', new ListHandler());
    this.handlers.set('kills', new KillsHandler());
    this.handlers.set('map', new MapHandler());
    this.handlers.set('loss', new LossHandler());
    this.handlers.set('ratio', new RatioHandler());
    this.handlers.set('shipkill', new ShipKillHandler());
    this.handlers.set('shiploss', new ShipLossHandler());
    this.handlers.set('distribution', new DistributionHandler());
    this.handlers.set('corps', new CorpsHandler());
    this.handlers.set('heatmap', new HeatmapHandler());
    this.handlers.set('efficiency', new EfficiencyHandler());
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
