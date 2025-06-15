/**
 * Comprehensive API response validation schemas
 * Using Zod for runtime type validation and TypeScript inference
 */

import { z } from 'zod';

/**
 * Generic API response wrapper schema
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    success: z.boolean().default(true),
    message: z.string().optional(),
    status: z.number(),
  });

/**
 * API error response schema
 */
export const ApiErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  status: z.number(),
  details: z.record(z.unknown()).optional(),
});

/**
 * zKillboard API schemas
 */
export const ZkillResponseSchema = z.object({
  killID: z.number().optional(),
  killmail_id: z.number(),
  zkb: z.object({
    hash: z.string(),
    totalValue: z.number(),
    points: z.number().default(0),
    npc: z.boolean().default(false),
    solo: z.boolean().default(false),
    awox: z.boolean().default(false),
    labels: z.array(z.string()).default([]),
    locationID: z.number().optional(),
    fittedValue: z.number().default(0),
    droppedValue: z.number().default(0),
    destroyedValue: z.number().default(0),
  }),
  // Allow additional fields but validate core structure
}).passthrough();

/**
 * ESI API schemas
 */
export const ESICharacterSchema = z.object({
  alliance_id: z.number().optional(),
  ancestry_id: z.number().optional(),
  birthday: z.string(),
  bloodline_id: z.number(),
  corporation_id: z.number(),
  description: z.string().optional(),
  faction_id: z.number().optional(),
  gender: z.enum(['female', 'male']),
  name: z.string(),
  race_id: z.number(),
  security_status: z.number().optional(),
  title: z.string().optional(),
});

export const ESICorporationSchema = z.object({
  alliance_id: z.number().optional(),
  ceo_id: z.number(),
  creator_id: z.number(),
  date_founded: z.string().optional(),
  description: z.string().optional(),
  faction_id: z.number().optional(),
  home_station_id: z.number().optional(),
  member_count: z.number(),
  name: z.string(),
  shares: z.number().optional(),
  tax_rate: z.number(),
  ticker: z.string(),
  url: z.string().optional(),
  war_eligible: z.boolean().optional(),
});

export const ESIAllianceSchema = z.object({
  creator_corporation_id: z.number(),
  creator_id: z.number(),
  date_founded: z.string(),
  executor_corporation_id: z.number().optional(),
  faction_id: z.number().optional(),
  name: z.string(),
  ticker: z.string(),
});

/**
 * Map API schemas
 */
export const CharacterInfoSchema = z.object({
  eve_id: z.string(),
  name: z.string(),
  alliance_id: z.number().nullable(),
  alliance_ticker: z.string().nullable(),
  corporation_id: z.number(),
  corporation_ticker: z.string(),
});

export const MapActivityDataSchema = z.object({
  timestamp: z.string(),
  character: CharacterInfoSchema,
  signatures: z.number(),
  connections: z.number(),
  passages: z.number(),
});

export const MapActivityResponseSchema = z.object({
  data: z.array(MapActivityDataSchema),
});

export const UserCharacterGroupSchema = z.object({
  main_character_eve_id: z.string().nullable(),
  characters: z.array(CharacterInfoSchema),
});

export const UserCharactersResponseSchema = z.object({
  data: z.array(UserCharacterGroupSchema),
});

/**
 * HTTP response schemas with proper unknown handling
 */
export const HttpResponseSchema = z.object({
  status: z.number(),
  statusText: z.string(),
  headers: z.record(z.string()),
  data: z.unknown(), // Use unknown instead of any
});

/**
 * Pagination schemas
 */
export const PaginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  hasMore: z.boolean(),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    pagination: PaginationMetaSchema,
  });

/**
 * WebSocket message schemas
 */
export const WebSocketMessageSchema = z.object({
  type: z.string(),
  data: z.unknown(),
  timestamp: z.string(),
});

export const WebSocketKillmailMessageSchema = z.object({
  type: z.literal('killmail'),
  data: z.unknown(), // Will be validated by specific killmail schema
  timestamp: z.string(),
});

/**
 * Type inference helpers
 */
export type ZkillResponse = z.infer<typeof ZkillResponseSchema>;
export type ESICharacter = z.infer<typeof ESICharacterSchema>;
export type ESICorporation = z.infer<typeof ESICorporationSchema>;
export type ESIAlliance = z.infer<typeof ESIAllianceSchema>;
export type MapActivityResponse = z.infer<typeof MapActivityResponseSchema>;
export type UserCharactersResponse = z.infer<typeof UserCharactersResponseSchema>;
export type HttpResponse = z.infer<typeof HttpResponseSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;