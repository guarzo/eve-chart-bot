/**
 * Base repository interfaces used across all bounded contexts
 * Defines common patterns for data access
 */

import { OperationResult, PaginationOptions, SortOptions } from '../types/common';

// Base repository interface that all repositories must implement
export interface BaseRepository<TEntity, TId> {
  findById(id: TId): Promise<TEntity | null>;
  findMany(options?: PaginationOptions & SortOptions): Promise<TEntity[]>;
  save(entity: TEntity): Promise<OperationResult<TEntity>>;
  delete(id: TId): Promise<OperationResult<boolean>>;
  exists(id: TId): Promise<boolean>;
}

// Repository interface for entities that can be queried by time range
export interface TimeRangeRepository<TEntity> {
  findByTimeRange(startDate: Date, endDate: Date): Promise<TEntity[]>;
}

// Repository interface for entities associated with characters
export interface CharacterRepository<TEntity> {
  findByCharacterId(characterId: bigint): Promise<TEntity[]>;
  findByCharacterIds(characterIds: bigint[]): Promise<TEntity[]>;
}

// Repository interface for bulk operations
export interface BulkRepository<TEntity> {
  saveMany(entities: TEntity[]): Promise<OperationResult<TEntity[]>>;
  deleteMany(ids: unknown[]): Promise<OperationResult<number>>;
}

// Repository interface for aggregation queries
export interface AggregationRepository {
  count(filters?: Record<string, unknown>): Promise<number>;
  sum(field: string, filters?: Record<string, unknown>): Promise<bigint>;
  average(field: string, filters?: Record<string, unknown>): Promise<number>;
  groupBy(field: string, filters?: Record<string, unknown>): Promise<Record<string, number>>;
}

// Combined repository interface for complex entities
export interface CompleteRepository<TEntity, TId>
  extends BaseRepository<TEntity, TId>,
    BulkRepository<TEntity>,
    AggregationRepository {}
