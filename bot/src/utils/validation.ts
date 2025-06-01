/**
 * Common validation utilities for domain entities
 */

import { z } from "zod";

// Common schema components
export const PositiveNumberSchema = z.number().positive();
export const NonNegativeNumberSchema = z.number().min(0);
export const BigIntSchema = z.union([
  z.bigint(),
  z.string().transform((val) => {
    try {
      return BigInt(val);
    } catch {
      throw new Error(`Invalid BigInt value: ${val}`);
    }
  }),
  z.number().transform((val) => BigInt(Math.floor(val))),
]);

export const EVEIdSchema = z.union([
  z.bigint().positive(),
  z
    .string()
    .min(1)
    .transform((val) => {
      try {
        const bigIntVal = BigInt(val);
        if (bigIntVal <= 0n) {
          throw new Error("Must be positive");
        }
        return bigIntVal;
      } catch {
        throw new Error(`Invalid EVE ID: ${val}`);
      }
    }),
  z
    .number()
    .positive()
    .int()
    .transform((val) => BigInt(val)),
]);

export const LabelsSchema = z.array(z.string()).default([]);

// Character schemas
export const CharacterPropsSchema = z.object({
  eveId: EVEIdSchema,
  name: z.string().min(1),
  corporationId: EVEIdSchema.optional(),
  allianceId: EVEIdSchema.optional(),
  isMain: z.boolean().default(false),
  labels: LabelsSchema,
  characterGroupId: EVEIdSchema.optional(),
});

export const CharacterGroupPropsSchema = z.object({
  id: EVEIdSchema.optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  labels: LabelsSchema,
  characters: z.array(CharacterPropsSchema).default([]),
});

// Killmail schemas
export const KillmailAttackerPropsSchema = z.object({
  characterId: EVEIdSchema.optional(),
  corporationId: EVEIdSchema.optional(),
  allianceId: EVEIdSchema.optional(),
  shipTypeId: NonNegativeNumberSchema.default(0),
  weaponTypeId: NonNegativeNumberSchema.default(0),
  damageDone: NonNegativeNumberSchema.default(0),
  finalBlow: z.boolean().default(false),
  securityStatus: z.number().default(0),
});

export const KillmailVictimPropsSchema = z.object({
  characterId: EVEIdSchema.optional(),
  corporationId: EVEIdSchema.optional(),
  allianceId: EVEIdSchema.optional(),
  shipTypeId: NonNegativeNumberSchema.default(0),
  damageTaken: NonNegativeNumberSchema.default(0),
});

export const KillmailPropsSchema = z.object({
  killmailId: EVEIdSchema,
  killTime: z.date().default(() => new Date()),
  npc: z.boolean().default(false),
  solo: z.boolean().default(false),
  awox: z.boolean().default(false),
  shipTypeId: NonNegativeNumberSchema.default(0),
  systemId: NonNegativeNumberSchema.default(0),
  totalValue: BigIntSchema.default(BigInt(0)),
  points: NonNegativeNumberSchema.default(0),
  attackers: z.array(KillmailAttackerPropsSchema).default([]),
  victim: KillmailVictimPropsSchema.optional(),
});

// Kill/Loss Fact schemas
export const KillFactPropsSchema = z.object({
  killmailId: EVEIdSchema,
  killTime: z.date().default(() => new Date()),
  npc: z.boolean().default(false),
  solo: z.boolean().default(false),
  awox: z.boolean().default(false),
  shipTypeId: NonNegativeNumberSchema.default(0),
  systemId: NonNegativeNumberSchema.default(0),
  labels: LabelsSchema,
  totalValue: BigIntSchema.default(BigInt(0)),
  points: NonNegativeNumberSchema.default(0),
});

export const LossFactPropsSchema = z.object({
  killmailId: EVEIdSchema,
  lossTime: z.date().default(() => new Date()),
  npc: z.boolean().default(false),
  solo: z.boolean().default(false),
  awox: z.boolean().default(false),
  shipTypeId: NonNegativeNumberSchema.default(0),
  systemId: NonNegativeNumberSchema.default(0),
  labels: LabelsSchema,
  totalValue: BigIntSchema.default(BigInt(0)),
  points: NonNegativeNumberSchema.default(0),
});

// Map Activity schema
export const MapActivityPropsSchema = z.object({
  systemId: NonNegativeNumberSchema,
  timestamp: z.date().default(() => new Date()),
  activityType: z.string().min(1),
  characterCount: NonNegativeNumberSchema.default(0),
  shipCount: NonNegativeNumberSchema.default(0),
  labels: LabelsSchema,
});

// Chart data schemas
export const ChartDatasetSchema = z.object({
  label: z.string(),
  data: z.array(z.number()),
  backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderWidth: z.number().optional(),
  type: z.string().optional(),
  displayType: z.string().optional(),
  fill: z.boolean().optional(),
  tension: z.number().optional(),
});

export const ChartDataSchema = z.object({
  labels: z.array(z.string()),
  datasets: z.array(ChartDatasetSchema),
  title: z.string().optional(),
  displayType: z.string().optional(),
});

export const ChartOptionsSchema = z.object({
  width: PositiveNumberSchema.default(800),
  height: PositiveNumberSchema.default(600),
  title: z.string().optional(),
  showLegend: z.boolean().default(true),
  showLabels: z.boolean().default(true),
  lightMode: z.boolean().default(false),
  responsive: z.boolean().default(true),
  maintainAspectRatio: z.boolean().default(false),
});

// API Response schemas
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export const PaginationSchema = z.object({
  page: PositiveNumberSchema.default(1),
  pageSize: PositiveNumberSchema.default(10),
  total: NonNegativeNumberSchema.optional(),
});

// Query parameter schemas
export const DateRangeSchema = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "Start date must be before or equal to end date",
  });

export const FilterSchema = z.object({
  characterGroups: z.array(z.string()).optional(),
  shipTypes: z.array(z.number()).optional(),
  systems: z.array(z.number()).optional(),
  dateRange: DateRangeSchema.optional(),
  labels: z.array(z.string()).optional(),
});

// Validation helper functions
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  entityName?: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const entityPrefix = entityName ? `${entityName} ` : "";
      throw new Error(
        `${entityPrefix}Validation failed: ${error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
}

export function safeParseWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  return schema.safeParse(data);
}

export function validateEVEId(
  value: unknown,
  fieldName: string = "EVE ID"
): bigint {
  const result = EVEIdSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`${fieldName} validation failed: ${result.error.message}`);
  }
  return result.data;
}

export function validateEVEIds(
  values: unknown[],
  fieldName: string = "EVE IDs"
): bigint[] {
  return values.map((value) => validateEVEId(value, fieldName));
}

export function validateDateRange(
  startDate: unknown,
  endDate: unknown
): { startDate: Date; endDate: Date } {
  return validateWithSchema(
    z.object({
      startDate: z.date(),
      endDate: z.date(),
    }),
    { startDate, endDate },
    "Date range"
  );
}

// Type definitions
export type CharacterProps = z.infer<typeof CharacterPropsSchema>;
export type CharacterGroupProps = z.infer<typeof CharacterGroupPropsSchema>;
export type KillmailProps = z.infer<typeof KillmailPropsSchema>;
export type KillmailAttackerProps = z.infer<typeof KillmailAttackerPropsSchema>;
export type KillmailVictimProps = z.infer<typeof KillmailVictimPropsSchema>;
export type KillFactProps = z.infer<typeof KillFactPropsSchema>;
export type LossFactProps = z.infer<typeof LossFactPropsSchema>;
export type MapActivityProps = z.infer<typeof MapActivityPropsSchema>;
export type ChartDataProps = z.infer<typeof ChartDataSchema>;
export type ChartOptionsProps = z.infer<typeof ChartOptionsSchema>;
export type ApiResponseProps = z.infer<typeof ApiResponseSchema>;
export type PaginationProps = z.infer<typeof PaginationSchema>;
export type DateRangeProps = z.infer<typeof DateRangeSchema>;
export type FilterProps = z.infer<typeof FilterSchema>;
