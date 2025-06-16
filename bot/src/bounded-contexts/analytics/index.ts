/**
 * Analytics Bounded Context - Public API
 * Exports the public interface for chart generation and analytics
 */

// Domain exports
export * from './domain/value-objects/ChartConfiguration';
export * from './domain/value-objects/ChartData';
export { 
  ChartDataProcessor,
  type KillDataPoint,
  type LossDataPoint 
} from './domain/services/ChartDataProcessor';
export * from './domain/services/ChartProcessorFactory';
export type { IChartDataProcessor } from './domain/services/IChartDataProcessor';
export * from './domain/services/processors/KillsDataProcessor';
export * from './domain/services/processors/LossDataProcessor';
export * from './domain/services/processors/EfficiencyDataProcessor';
export * from './domain/services/processors/HeatmapDataProcessor';
export * from './domain/services/processors/ShipTypesDataProcessor';
export * from './domain/services/processors/TrendDataProcessor';
export * from './domain/services/processors/RatioDataProcessor';
export * from './domain/services/processors/DistributionDataProcessor';
export * from './domain/services/processors/CorpsDataProcessor';

// Application exports  
export * from './application/use-cases/GenerateChartUseCase';
export * from './application/services/IChartService';
export * from './application/services/UnifiedChartService';

// Infrastructure exports (for dependency injection)
export * from './infrastructure/repositories/PrismaKillDataRepository';
export * from './infrastructure/repositories/PrismaLossDataRepository';
export * from './infrastructure/repositories/RedisChartCacheRepository';
export * from './infrastructure/rendering/CanvasChartRenderer';
export * from './infrastructure/ConsolidatedChartFactory';

// Compatibility layer
export * from './infrastructure/adapters/LegacyChartServiceAdapter';