/**
 * External API DTOs
 * These interfaces match the snake_case format from external APIs
 * They should only be used at the infrastructure boundary
 */

// EVE Online ESI API DTOs
export interface KillmailApiDto {
  killmail_id: number;
  killmail_time: string;
  solar_system_id: number;
  moon_id?: number;
  war_id?: number;
  victim: VictimApiDto;
  attackers: AttackerApiDto[];
  killmail_hash: string;
}

export interface VictimApiDto {
  character_id?: number;
  corporation_id?: number;
  alliance_id?: number;
  ship_type_id: number;
  damage_taken: number;
  items?: ItemApiDto[];
  position?: PositionApiDto;
}

export interface AttackerApiDto {
  character_id?: number;
  corporation_id?: number;
  alliance_id?: number;
  faction_id?: number;
  damage_done: number;
  final_blow: boolean;
  security_status: number;
  ship_type_id?: number;
  weapon_type_id?: number;
}

export interface ItemApiDto {
  item_type_id: number;
  singleton: number;
  flag: number;
  quantity_destroyed?: number;
  quantity_dropped?: number;
}

export interface PositionApiDto {
  x: number;
  y: number;
  z: number;
}

// Wanderer Map API DTOs
export interface MapActivityApiDto {
  character_id: string;
  character_name: string;
  corporation_id: string;
  corporation_ticker: string;
  alliance_id?: string;
  alliance_ticker?: string;
  timestamp: string;
  signatures: number;
  connections: number;
  passages: number;
}

export interface UserCharacterApiDto {
  eve_id: string;
  name: string;
  corporation_id: string;
  corporation_ticker: string;
  alliance_id?: string;
  alliance_ticker?: string;
  main_character_eve_id?: string;
}

// WebSocket DTOs
export interface WebSocketKillmailDto {
  killmail_id: string;
  kill_time: string;
  solar_system_id: number;
  ship_type_id: number;
  character_id?: string;
  character_name?: string;
  corporation_id?: string;
  corporation_name?: string;
  alliance_id?: string;
  alliance_name?: string;
  total_value: string;
  npc: boolean;
  solo: boolean;
  awox: boolean;
  labels: string[];
  attackers: WebSocketAttackerDto[];
  victim: WebSocketVictimDto;
}

export interface WebSocketAttackerDto {
  character_id?: string;
  character_name?: string;
  corporation_id?: string;
  corporation_name?: string;
  alliance_id?: string;
  alliance_name?: string;
  damage_done: number;
  final_blow: boolean;
  security_status?: number;
  ship_type_id?: number;
  weapon_type_id?: number;
}

export interface WebSocketVictimDto {
  character_id?: string;
  character_name?: string;
  corporation_id?: string;
  corporation_name?: string;
  alliance_id?: string;
  alliance_name?: string;
  ship_type_id: number;
  damage_taken: number;
}
