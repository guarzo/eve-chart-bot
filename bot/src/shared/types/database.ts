/**
 * Shared database-related type definitions
 * Extracted from inline types used across the codebase
 */

/**
 * Kill fact data structure for database operations
 */
export interface KillFactData {
  killmailId: bigint;
  killTime: Date;
  npc: boolean;
  solo: boolean;
  awox: boolean;
  shipTypeId: number;
  systemId: number;
  labels: string[];
  totalValue: bigint;
  points: number;
}

/**
 * Victim data structure for database operations
 */
export interface VictimData {
  characterId?: bigint;
  corporationId?: bigint;
  allianceId?: bigint;
  shipTypeId: number;
  damageTaken: number;
}

/**
 * Attacker data structure for database operations
 */
export interface AttackerData {
  characterId?: bigint;
  corporationId?: bigint;
  allianceId?: bigint;
  damageDone: number;
  finalBlow: boolean;
  securityStatus?: number;
  shipTypeId?: number;
  weaponTypeId?: number;
}

/**
 * Character role in a kill/loss event
 */
export type CharacterRole = 'attacker' | 'victim';

/**
 * Character involvement data structure
 */
export interface InvolvedCharacterData {
  characterId: bigint;
  role: CharacterRole;
}

/**
 * Complete mapped kill data structure
 */
export interface MappedKillData {
  killFact: KillFactData;
  victim: VictimData;
  attackers: AttackerData[];
  involvedCharacters: InvolvedCharacterData[];
}

/**
 * Loss data structure for character losses
 */
export interface LossData {
  killmailId: bigint;
  characterId: bigint;
  killTime: Date;
  shipTypeId: number;
  systemId: number;
  totalValue: bigint;
  attackerCount: number;
  labels: string[];
}

/**
 * Character data for groups and syncing
 */
export interface CharacterData {
  eveId: bigint;
  name: string;
  corporationId?: bigint;
  allianceId?: bigint;
}

/**
 * Character group creation data
 */
export interface CharacterGroupData {
  mapName: string;
  mainCharacterId?: bigint | null;
}

/**
 * Character statistics summary
 */
export interface CharacterStats {
  killCount: number;
  lossCount: number;
  efficiency: number;
  totalIskDestroyed: bigint;
  totalIskLost: bigint;
}