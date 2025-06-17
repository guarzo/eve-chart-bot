/**
 * Shared API-related type definitions
 * Extracted from inline types used across HTTP clients and services
 */

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  status: number;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  status: number;
  details?: Record<string, any>;
}

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  headers?: Record<string, string>;
  apiKey?: string;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Retry configuration for HTTP requests
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * ESI (EVE Swagger Interface) types
 */
export interface ESICharacterInfo {
  characterId: bigint;
  name: string;
  corporationId: bigint;
  allianceId?: bigint;
  securityStatus?: number;
}

export interface ESICorporationInfo {
  corporationId: bigint;
  name: string;
  ticker: string;
  memberCount: number;
  allianceId?: bigint;
}

export interface ESIAllianceInfo {
  allianceId: bigint;
  name: string;
  ticker: string;
  corporationCount: number;
}

/**
 * Map API response types
 */
export interface MapActivityResponse {
  data: MapActivityData[];
}

export interface MapActivityData {
  timestamp: string;
  character: {
    eve_id: string;
    name: string;
    alliance_id: number | null;
    alliance_ticker: string | null;
    corporation_id: number;
    corporation_ticker: string;
  };
  signatures: number;
  connections: number;
  passages: number;
}

export interface UserCharactersResponse {
  data: UserCharacterGroup[];
}

export interface UserCharacterGroup {
  main_character_eve_id: string | null;
  characters: CharacterInfo[];
}

export interface CharacterInfo {
  eve_id: string;
  name: string;
  alliance_id: number | null;
  alliance_ticker: string | null;
  corporation_id: number;
  corporation_ticker: string;
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
  timestamp: string;
}

export interface WebSocketKillmailMessage {
  type: 'killmail';
  data: any; // WebSocketKillmail type
  timestamp: string;
}

/**
 * Discord API types
 */
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  permissions: string;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  guildId?: string;
}
