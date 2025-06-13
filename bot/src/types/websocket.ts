import { z } from "zod";

// WebSocket victim schema
export const WebSocketVictimSchema = z.object({
  character_id: z.number().optional(),
  character_name: z.string().optional(),
  corporation_id: z.number().optional(),
  corporation_name: z.string().optional(),
  alliance_id: z.number().optional(),
  alliance_name: z.string().optional(),
  faction_id: z.number().optional().nullable(),
  faction_name: z.string().optional().nullable(),
  ship_type_id: z.number(),
  ship_name: z.string().optional(),
  ship_group: z.string().optional(),
  ship_category: z.string().optional(),
  damage_taken: z.number(),
  items: z
    .array(
      z.object({
        type_id: z.number(),
        type_name: z.string().optional(),
        singleton: z.number(),
        flag: z.number(),
        quantity_dropped: z.number(),
        quantity_destroyed: z.number(),
      })
    )
    .optional(),
});

// WebSocket attacker schema
export const WebSocketAttackerSchema = z.object({
  character_id: z.number().optional(),
  character_name: z.string().optional(),
  corporation_id: z.number().optional(),
  corporation_name: z.string().optional(),
  alliance_id: z.number().optional(),
  alliance_name: z.string().optional(),
  faction_id: z.number().optional().nullable(),
  faction_name: z.string().optional().nullable(),
  security_status: z.number().optional(),
  ship_type_id: z.number().optional(),
  ship_name: z.string().optional(),
  ship_group: z.string().optional(),
  ship_category: z.string().optional(),
  weapon_type_id: z.number().optional(),
  weapon_name: z.string().optional(),
  damage_done: z.number(),
  final_blow: z.boolean(),
});

// WebSocket zkb data schema
export const WebSocketZkbSchema = z.object({
  location_id: z.number().optional(),
  hash: z.string(),
  fitted_value: z.number().optional(),
  dropped_value: z.number().optional(),
  destroyed_value: z.number().optional(),
  total_value: z.number(),
  points: z.number(),
  npc: z.boolean(),
  solo: z.boolean(),
  awox: z.boolean(),
  labels: z.array(z.string()).optional(),
  involved: z.number().optional(),
  red: z.boolean().optional(),
  blue: z.boolean().optional(),
});

// WebSocket position schema
export const WebSocketPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

// Complete WebSocket killmail schema
export const WebSocketKillmailSchema = z.object({
  killmail_id: z.number(),
  kill_time: z.string(),
  system_id: z.number(),
  victim: WebSocketVictimSchema,
  attackers: z.array(WebSocketAttackerSchema),
  zkb: WebSocketZkbSchema,
  position: WebSocketPositionSchema.optional().nullable(),
  war_id: z.number().optional().nullable(),
  is_npc: z.boolean().optional(),
  is_solo: z.boolean().optional(),
  is_awox: z.boolean().optional(),
});

// WebSocket killmail update event schema
export const WebSocketKillmailUpdateSchema = z.object({
  system_id: z.number(),
  killmails: z.array(WebSocketKillmailSchema),
  timestamp: z.string(),
  preload: z.boolean().optional(),
});

// Type exports
export type WebSocketVictim = z.infer<typeof WebSocketVictimSchema>;
export type WebSocketAttacker = z.infer<typeof WebSocketAttackerSchema>;
export type WebSocketZkb = z.infer<typeof WebSocketZkbSchema>;
export type WebSocketPosition = z.infer<typeof WebSocketPositionSchema>;
export type WebSocketKillmail = z.infer<typeof WebSocketKillmailSchema>;
export type WebSocketKillmailUpdate = z.infer<typeof WebSocketKillmailUpdateSchema>;

// WebSocket event types
export type WebSocketEvent =
  | {
      type: "killmail_update";
      payload: WebSocketKillmailUpdate;
    }
  | {
      type: "kill_count_update";
      payload: {
        system_id: number;
        count: number;
        timestamp: string;
      };
    };

// WebSocket subscription commands
export interface WebSocketSubscribeCommand {
  systems?: number[];
  character_ids?: number[];
}

export interface WebSocketSubscriptionResponse {
  subscription_id: string;
  subscribed_systems: number[];
  subscribed_characters: number[];
}