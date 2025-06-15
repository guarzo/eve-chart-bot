/**
 * Shared types used across all bounded contexts
 * These are the core building blocks of the EVE Online domain
 */

// Core EVE Online identifiers
export type EveId = bigint;
export type CharacterId = EveId;
export type CorporationId = EveId;
export type AllianceId = EveId;
export type KillmailId = bigint;
export type ShipTypeId = number;
export type SystemId = number;

// Geographic and temporal types
export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface TimeRange {
  startDate: Date;
  endDate: Date;
}

// Common value objects
export interface ISKValue {
  readonly amount: bigint;
  readonly formattedAmount: string;
}

export interface DateTimeStamp {
  readonly timestamp: Date;
  readonly isoString: string;
}

// Pagination and filtering
export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// Result types
export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  correlationId: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Common enums
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Chart and analytics types (will be extended in analytics bounded context)
export enum ChartType {
  KILLS = 'kills',
  LOSSES = 'losses', 
  EFFICIENCY = 'efficiency',
  HEATMAP = 'heatmap',
  DISTRIBUTION = 'distribution',
  TREND = 'trend'
}

export enum TimePeriod {
  HOUR = '1h',
  DAY = '1d',
  WEEK = '1w',
  MONTH = '1m',
  QUARTER = '3m',
  YEAR = '1y'
}