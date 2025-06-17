/**
 * Shared service-related type definitions
 * Extracted from inline types used across services
 */

/**
 * Service operation result
 */
export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Date range filter
 */
export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}

/**
 * Search parameters
 */
export interface SearchParams {
  query: string;
  filters?: Record<string, any>;
  pagination?: PaginationParams;
  sorting?: SortingParams;
}

/**
 * Sorting parameters
 */
export interface SortingParams {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  ttl: number;
  prefix?: string;
  serialize?: boolean;
}

/**
 * Background job configuration
 */
export interface JobConfig {
  name: string;
  schedule?: string;
  enabled: boolean;
  timeout?: number;
  retries?: number;
}

/**
 * Sync operation result
 */
export interface SyncResult {
  total: number;
  synced: number;
  skipped: number;
  errors: number;
  duration: number;
}

/**
 * Character sync result
 */
export interface CharacterSyncResult extends SyncResult {
  charactersAdded: number;
  charactersUpdated: number;
  groupsCreated: number;
  groupsUpdated: number;
}

/**
 * Ingestion statistics
 */
export interface IngestionStats {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  skipCount: number;
  duplicateCount: number;
  processingTimeMs: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * Metrics data point
 */
export interface MetricDataPoint {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  unit?: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  requestCount: number;
  errorCount: number;
  responseTime: number;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Feature flag configuration
 */
export interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage?: number;
  conditions?: Record<string, any>;
}
