/**
 * Shared Type Definitions Index
 * Centralized exports for all reusable type definitions
 */

// Database-related types
export * from './database';

// Chart-related types
export * from './chart';

// API-related types
export * from './api';

// Service-related types
export * from './service';

// Re-export common types for backward compatibility
export type { MappedKillData, KillFactData, VictimData, AttackerData } from './database';
export type { ShipDataEntry, TimeSeriesDataPoint, ChartTimePeriod } from './chart';
export type { ApiResponse, ApiErrorResponse, HttpClientConfig } from './api';
export type { ServiceResult, PaginatedResponse, SyncResult } from './service';