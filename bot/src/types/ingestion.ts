import { z } from 'zod';

// API Response Types
export const ZkillResponseSchema = z.object({
  killmail_id: z.number(),
  zkb: z.object({
    locationID: z.number().optional(),
    hash: z.string(),
    fittedValue: z.number().optional().default(0),
    droppedValue: z.number().optional().default(0),
    destroyedValue: z.number().optional().default(0),
    totalValue: z.number(),
    points: z.number().optional().default(0),
    npc: z.boolean().optional().default(false),
    solo: z.boolean().optional().default(false),
    awox: z.boolean().optional().default(false),
    labels: z.array(z.string()).optional().default([]),
  }),
});

// Basic Killmail Schema (from zKillboard)
export const BasicKillmailSchema = ZkillResponseSchema;

// Complete Killmail Schema (after ESI data is fetched)
export const CompleteKillmailSchema = BasicKillmailSchema.extend({
  killmail_time: z.string().optional(),
  solar_system_id: z.number().optional(),
  victim: z
    .object({
      character_id: z.number().optional(),
      corporation_id: z.number().optional(),
      alliance_id: z.number().optional(),
      ship_type_id: z.number().optional(),
      damage_taken: z.number().optional(),
      position: z
        .object({
          x: z.number(),
          y: z.number(),
          z: z.number(),
        })
        .optional(),
      items: z
        .array(
          z.object({
            type_id: z.number().optional(),
            flag: z.number().optional(),
            quantity_destroyed: z.number().optional(),
            quantity_dropped: z.number().optional(),
            singleton: z.number().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  attackers: z
    .array(
      z.object({
        character_id: z.number().optional(),
        corporation_id: z.number().optional(),
        alliance_id: z.number().optional(),
        damage_done: z.number().optional(),
        final_blow: z.boolean().optional(),
        security_status: z.number().optional(),
        ship_type_id: z.number().optional(),
        weapon_type_id: z.number().optional(),
      })
    )
    .optional(),
});

// Character Schema
export const CharacterSchema = z.object({
  eve_id: z.string(),
  name: z.string(),
  alliance_id: z.number().nullable(),
  alliance_ticker: z.string().nullable(),
  corporation_id: z.number(),
  corporation_ticker: z.string(),
});

// Map Activity Response Schema
export const MapActivityResponseSchema = z.object({
  data: z.array(
    z.object({
      timestamp: z.string(),
      character: CharacterSchema,
      signatures: z.number(),
      connections: z.number(),
      passages: z.number(),
    })
  ),
});

// User Characters Response Schema
export const UserCharactersResponseSchema = z.object({
  data: z.array(
    z.object({
      main_character_eve_id: z.string().nullable(),
      characters: z.array(CharacterSchema),
    })
  ),
});

// Database Types
export interface KillFact {
  killmailId: bigint;
  killTime: Date;
  systemId: number;
  totalValue: bigint;
  points: number;
  position?: any | null;
  items?: any | null;
}

export interface MapActivity {
  characterId: string;
  timestamp: Date;
  signatures: number;
  connections: number;
  passages: number;
  allianceId: number | null;
  corporationId: number;
}

export interface Character {
  eveId: string;
  name: string;
  allianceId: number | null;
  allianceTicker: string | null;
  corporationId: number;
  corporationTicker: string;
  createdAt: Date;
  updatedAt: Date;
  lastBackfillAt?: Date | null;
  characterGroupId?: string | null;
}

export interface CharacterGroup {
  id: string;
  slug: string;
  mainCharacterId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterWithRelations extends Character {
  characterGroup?: CharacterGroup | null;
  mainCharacter?: Character | null;
  altCharacters?: Character[];
  groupMainCharacter?: CharacterGroup | null;
}

export interface CharacterGroupWithRelations extends CharacterGroup {
  mainCharacter?: Character | null;
  characters: Character[];
}

// Ingestion Config
export interface IngestionConfig {
  zkillApiUrl: string;
  mapApiUrl?: string;
  mapApiKey?: string;
  esiApiUrl?: string;
  redisUrl?: string;
  cacheTtl?: number;
  batchSize?: number;
  backoffMs?: number;
  maxRetries?: number;
}

// Checkpoint Types
export interface IngestionCheckpoint {
  streamName: string;
  lastSeenId: bigint;
  lastSeenTime: Date;
}
