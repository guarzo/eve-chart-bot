/**
 * Centralized enum definitions for commonly used string literals
 * This eliminates magic strings and improves type safety
 */

// Chart periods
export enum ChartPeriod {
  TWENTY_FOUR_HOURS = '24h',
  SEVEN_DAYS = '7d',
  THIRTY_DAYS = '30d',
  NINETY_DAYS = '90d'
}

// Chart display types
export enum ChartDisplayType {
  BAR = 'bar',
  HORIZONTAL_BAR = 'horizontalBar',
  LINE = 'line',
  PIE = 'pie',
  BOXPLOT = 'boxplot',
  VIOLIN = 'violin',
  HEATMAP = 'heatmap',
  CALENDAR = 'calendar',
  DOUGHNUT = 'doughnut',
  RADAR = 'radar',
  POLAR_AREA = 'polarArea',
  BUBBLE = 'bubble',
  SCATTER = 'scatter',
  GAUGE = 'gauge'
}

// Chart source types
export enum ChartSourceType {
  KILLS = 'kills',
  MAP_ACTIVITY = 'map_activity'
}

// Chart metrics
export enum ChartMetric {
  VALUE = 'value',
  KILLS = 'kills',
  POINTS = 'points',
  ATTACKERS = 'attackers'
}

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

// Operation status
export enum OperationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// User roles (if needed for Discord integration)
export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
  OWNER = 'owner'
}

// Discord command types
export enum CommandType {
  CHART = 'chart',
  KILLS = 'kills',
  LOSSES = 'losses',
  EFFICIENCY = 'efficiency',
  MAP = 'map',
  TREND = 'trend',
  DISTRIBUTION = 'distribution',
  HEATMAP = 'heatmap',
  RATIO = 'ratio',
  CORPS = 'corps',
  SHIP_TYPES = 'shiptypes',
  LIST = 'list'
}

// HTTP methods
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

// Chart axis types
export enum ChartAxis {
  X = 'x',
  Y = 'y',
  Y2 = 'y2'
}

// Chart legend positions
export enum LegendPosition {
  TOP = 'top',
  BOTTOM = 'bottom',
  LEFT = 'left',
  RIGHT = 'right'
}

// Chart grouping options
export enum ChartGroupBy {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month'
}

// Sort directions
export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc'
}

// Environment types
export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TEST = 'test'
}