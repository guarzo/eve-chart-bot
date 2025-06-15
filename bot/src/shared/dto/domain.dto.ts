/**
 * Domain DTOs
 * These interfaces use camelCase and match our internal domain model
 * They should be used throughout the application layer
 */

import { CharacterId, CorporationId, AllianceId, KillmailId, ShipTypeId, SystemId } from '../types/common';

// Domain Killmail DTOs
export interface KillmailDto {
  killmailId: KillmailId;
  killTime: Date;
  systemId: SystemId;
  moonId?: number;
  warId?: number;
  victim: VictimDto;
  attackers: AttackerDto[];
  killmailHash: string;
  totalValue: bigint;
  npc: boolean;
  solo: boolean;
  awox: boolean;
  labels: string[];
  points: number;
}

export interface VictimDto {
  characterId?: CharacterId;
  corporationId?: CorporationId;
  allianceId?: AllianceId;
  shipTypeId: ShipTypeId;
  damageTaken: number;
  items?: ItemDto[];
  position?: PositionDto;
}

export interface AttackerDto {
  characterId?: CharacterId;
  corporationId?: CorporationId;
  allianceId?: AllianceId;
  factionId?: number;
  damageDone: number;
  finalBlow: boolean;
  securityStatus: number;
  shipTypeId?: ShipTypeId;
  weaponTypeId?: number;
}

export interface ItemDto {
  itemTypeId: number;
  singleton: number;
  flag: number;
  quantityDestroyed?: number;
  quantityDropped?: number;
}

export interface PositionDto {
  x: number;
  y: number;
  z: number;
}

// Domain Character DTOs
export interface CharacterDto {
  eveId: CharacterId;
  name: string;
  corporationId: CorporationId;
  corporationTicker: string;
  allianceId?: AllianceId;
  allianceTicker?: string;
  characterGroupId?: string;
  mainCharacterId?: CharacterId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterGroupDto {
  id: string;
  mapName: string;
  mainCharacterId?: CharacterId;
  characters: CharacterDto[];
  createdAt: Date;
  updatedAt: Date;
}

// Domain Map Activity DTOs
export interface MapActivityDto {
  characterId: CharacterId;
  timestamp: Date;
  signatures: number;
  connections: number;
  passages: number;
  corporationId: CorporationId;
  allianceId?: AllianceId;
}

// Domain Loss DTOs
export interface LossFactDto {
  killmailId: KillmailId;
  characterId: CharacterId;
  killTime: Date;
  shipTypeId: ShipTypeId;
  systemId: SystemId;
  totalValue: bigint;
  attackerCount: number;
  labels: string[];
}