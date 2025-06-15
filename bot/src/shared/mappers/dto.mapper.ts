/**
 * DTO Mapping Utilities
 * Converts between external API DTOs (snake_case) and internal domain DTOs (camelCase)
 */

import { BigIntTransformer } from '../utils/BigIntTransformer';
import {
  KillmailApiDto,
  VictimApiDto,
  AttackerApiDto,
  MapActivityApiDto,
  UserCharacterApiDto,
  WebSocketKillmailDto,
  WebSocketAttackerDto,
  WebSocketVictimDto
} from '../dto/external-api.dto';
import {
  KillmailDto,
  VictimDto,
  AttackerDto,
  CharacterDto,
  MapActivityDto
} from '../dto/domain.dto';

/**
 * Map ESI Killmail API response to domain DTO
 */
export function mapKillmailApiToDomain(api: KillmailApiDto): Partial<KillmailDto> {
  return {
    killmailId: BigIntTransformer.toBigInt(api.killmail_id) ?? BigInt(0),
    killTime: new Date(api.killmail_time),
    systemId: api.solar_system_id,
    moonId: api.moon_id,
    warId: api.war_id,
    victim: mapVictimApiToDomain(api.victim),
    attackers: api.attackers.map(mapAttackerApiToDomain),
    killmailHash: api.killmail_hash,
    // Note: totalValue, npc, solo, awox, labels, points would need to be calculated/fetched separately
  };
}

/**
 * Map ESI Victim API response to domain DTO
 */
export function mapVictimApiToDomain(api: VictimApiDto): VictimDto {
  return {
    characterId: api.character_id ? (BigIntTransformer.toBigInt(api.character_id) ?? undefined) : undefined,
    corporationId: api.corporation_id ? (BigIntTransformer.toBigInt(api.corporation_id) ?? undefined) : undefined,
    allianceId: api.alliance_id ? (BigIntTransformer.toBigInt(api.alliance_id) ?? undefined) : undefined,
    shipTypeId: api.ship_type_id,
    damageTaken: api.damage_taken,
    position: api.position,
    // Items mapping would be implemented if needed
  };
}

/**
 * Map ESI Attacker API response to domain DTO
 */
export function mapAttackerApiToDomain(api: AttackerApiDto): AttackerDto {
  return {
    characterId: api.character_id ? (BigIntTransformer.toBigInt(api.character_id) ?? undefined) : undefined,
    corporationId: api.corporation_id ? (BigIntTransformer.toBigInt(api.corporation_id) ?? undefined) : undefined,
    allianceId: api.alliance_id ? (BigIntTransformer.toBigInt(api.alliance_id) ?? undefined) : undefined,
    factionId: api.faction_id,
    damageDone: api.damage_done,
    finalBlow: api.final_blow,
    securityStatus: api.security_status,
    shipTypeId: api.ship_type_id,
    weaponTypeId: api.weapon_type_id,
  };
}

/**
 * Map Wanderer Map activity API response to domain DTO
 */
export function mapMapActivityApiToDomain(api: MapActivityApiDto): MapActivityDto {
  return {
    characterId: BigIntTransformer.toRequiredBigInt(api.character_id),
    timestamp: new Date(api.timestamp),
    signatures: api.signatures,
    connections: api.connections,
    passages: api.passages,
    corporationId: BigIntTransformer.toRequiredBigInt(api.corporation_id),
    allianceId: api.alliance_id ? (BigIntTransformer.toBigInt(api.alliance_id) ?? undefined) : undefined,
  };
}

/**
 * Map Wanderer Map user character API response to domain DTO
 */
export function mapUserCharacterApiToDomain(api: UserCharacterApiDto): CharacterDto {
  return {
    eveId: BigIntTransformer.toRequiredBigInt(api.eve_id),
    name: api.name,
    corporationId: BigIntTransformer.toRequiredBigInt(api.corporation_id),
    corporationTicker: api.corporation_ticker,
    allianceId: api.alliance_id ? (BigIntTransformer.toBigInt(api.alliance_id) ?? undefined) : undefined,
    allianceTicker: api.alliance_ticker,
    mainCharacterId: api.main_character_eve_id ? (BigIntTransformer.toBigInt(api.main_character_eve_id) ?? undefined) : undefined,
    createdAt: new Date(), // Would need to be fetched from DB or API
    updatedAt: new Date(), // Would need to be fetched from DB or API
  };
}

/**
 * Map WebSocket killmail to domain DTO
 */
export function mapWebSocketKillmailToDomain(ws: WebSocketKillmailDto): KillmailDto {
  return {
    killmailId: BigIntTransformer.toRequiredBigInt(ws.killmail_id),
    killTime: new Date(ws.kill_time),
    systemId: ws.solar_system_id,
    victim: mapWebSocketVictimToDomain(ws.victim),
    attackers: ws.attackers.map(mapWebSocketAttackerToDomain),
    killmailHash: '', // Not provided by WebSocket
    totalValue: BigIntTransformer.toRequiredBigInt(ws.total_value),
    npc: ws.npc,
    solo: ws.solo,
    awox: ws.awox,
    labels: ws.labels || [],
    points: 0, // Would need to be calculated
  };
}

/**
 * Map WebSocket victim to domain DTO
 */
export function mapWebSocketVictimToDomain(ws: WebSocketVictimDto): VictimDto {
  return {
    characterId: ws.character_id ? (BigIntTransformer.toBigInt(ws.character_id) ?? undefined) : undefined,
    corporationId: ws.corporation_id ? (BigIntTransformer.toBigInt(ws.corporation_id) ?? undefined) : undefined,
    allianceId: ws.alliance_id ? (BigIntTransformer.toBigInt(ws.alliance_id) ?? undefined) : undefined,
    shipTypeId: ws.ship_type_id,
    damageTaken: ws.damage_taken,
  };
}

/**
 * Map WebSocket attacker to domain DTO
 */
export function mapWebSocketAttackerToDomain(ws: WebSocketAttackerDto): AttackerDto {
  return {
    characterId: ws.character_id ? (BigIntTransformer.toBigInt(ws.character_id) ?? undefined) : undefined,
    corporationId: ws.corporation_id ? (BigIntTransformer.toBigInt(ws.corporation_id) ?? undefined) : undefined,
    allianceId: ws.alliance_id ? (BigIntTransformer.toBigInt(ws.alliance_id) ?? undefined) : undefined,
    damageDone: ws.damage_done,
    finalBlow: ws.final_blow,
    securityStatus: ws.security_status || 0,
    shipTypeId: ws.ship_type_id,
    weaponTypeId: ws.weapon_type_id,
  };
}

/**
 * Map domain DTO to database model format (for Prisma)
 * This handles the camelCase to snake_case conversion for database operations
 */
export function mapDomainToDatabase<T extends Record<string, any>>(domain: T): Record<string, any> {
  const mapped: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(domain)) {
    // Convert camelCase to snake_case
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    mapped[snakeKey] = value;
  }
  
  return mapped;
}