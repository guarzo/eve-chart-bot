import { z } from 'zod';

// Discord ID patterns
const DISCORD_SNOWFLAKE_REGEX = /^\d{17,19}$/;
const DISCORD_MENTION_USER_REGEX = /^<@!?(\d{17,19})>$/;
const DISCORD_MENTION_CHANNEL_REGEX = /^<#(\d{17,19})>$/;
const DISCORD_MENTION_ROLE_REGEX = /^<@&(\d{17,19})>$/;

// Common Discord ID schemas
export const snowflakeSchema = z.string().regex(DISCORD_SNOWFLAKE_REGEX, {
  message: 'Invalid Discord ID format',
});

export const userIdSchema = z.string().transform(val => {
  // Handle user mentions
  const mentionMatch = val.match(DISCORD_MENTION_USER_REGEX);
  if (mentionMatch) {
    return mentionMatch[1];
  }
  // Validate as snowflake
  if (DISCORD_SNOWFLAKE_REGEX.test(val)) {
    return val;
  }
  throw new z.ZodError([
    {
      code: z.ZodIssueCode.custom,
      message: 'Invalid user ID or mention format',
      path: [],
    },
  ]);
});

export const channelIdSchema = z.string().transform(val => {
  // Handle channel mentions
  const mentionMatch = val.match(DISCORD_MENTION_CHANNEL_REGEX);
  if (mentionMatch) {
    return mentionMatch[1];
  }
  // Validate as snowflake
  if (DISCORD_SNOWFLAKE_REGEX.test(val)) {
    return val;
  }
  throw new z.ZodError([
    {
      code: z.ZodIssueCode.custom,
      message: 'Invalid channel ID or mention format',
      path: [],
    },
  ]);
});

export const roleIdSchema = z.string().transform(val => {
  // Handle role mentions
  const mentionMatch = val.match(DISCORD_MENTION_ROLE_REGEX);
  if (mentionMatch) {
    return mentionMatch[1];
  }
  // Validate as snowflake
  if (DISCORD_SNOWFLAKE_REGEX.test(val)) {
    return val;
  }
  throw new z.ZodError([
    {
      code: z.ZodIssueCode.custom,
      message: 'Invalid role ID or mention format',
      path: [],
    },
  ]);
});

// Common parameter schemas
export const timeParameterSchema = z.enum(['7', '14', '24', '30']).transform(Number);

export const chartViewSchema = z.enum(['pie', 'bar', 'boxplot', 'violin', 'horizontalBar', 'verticalBar']);

// Command-specific schemas
export const killsCommandSchema = z.object({
  time: timeParameterSchema.optional().default('7'),
});

export const mapCommandSchema = z.object({
  time: timeParameterSchema.optional().default('7'),
});

export const lossCommandSchema = z.object({
  time: timeParameterSchema.optional().default('7'),
});

export const ratioCommandSchema = z.object({
  time: timeParameterSchema.optional().default('7'),
});

export const shipKillCommandSchema = z.object({
  time: timeParameterSchema.optional().default('7'),
});

export const shipLossCommandSchema = z.object({
  time: timeParameterSchema.optional().default('7'),
});

export const distributionCommandSchema = z.object({
  time: timeParameterSchema.optional().default('7'),
  view: z.enum(['pie', 'bar', 'boxplot', 'violin']).optional().default('pie'),
});

export const corpsCommandSchema = z.object({
  time: timeParameterSchema.optional().default('7'),
  view: z.enum(['horizontalBar', 'verticalBar', 'pie']).optional().default('horizontalBar'),
});

export const heatmapCommandSchema = z.object({
  time: timeParameterSchema.optional().default('7'),
});

export const efficiencyCommandSchema = z.object({
  time: timeParameterSchema.optional().default('7'),
});

// Map of subcommand names to their schemas
export const commandSchemas = {
  kills: killsCommandSchema,
  map: mapCommandSchema,
  loss: lossCommandSchema,
  ratio: ratioCommandSchema,
  shipkill: shipKillCommandSchema,
  shiploss: shipLossCommandSchema,
  distribution: distributionCommandSchema,
  corps: corpsCommandSchema,
  heatmap: heatmapCommandSchema,
  efficiency: efficiencyCommandSchema,
} as const;

// Type exports
export type CommandName = keyof typeof commandSchemas;
export type CommandSchema<T extends CommandName> = z.infer<(typeof commandSchemas)[T]>;
