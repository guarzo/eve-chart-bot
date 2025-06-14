import { CommandInteraction, MessageFlags } from 'discord.js';
import { z } from 'zod';
import { logger } from '../../logger';
import { commandSchemas, CommandName } from './schemas';
import { rateLimiters, rateLimitConfigs } from './rateLimiter';
import { securityMonitor } from './securityMonitor';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: z.ZodError;
}

export interface SecurityCheckResult {
  passed: boolean;
  reason?: string;
  suspicious?: boolean;
}

/**
 * Validates command inputs using Zod schemas
 */
export async function validateCommand<T extends CommandName>(
  interaction: CommandInteraction,
  commandName: T
): Promise<ValidationResult<z.infer<(typeof commandSchemas)[T]>>> {
  try {
    const schema = commandSchemas[commandName];
    if (!schema) {
      return {
        success: false,
        error: `No validation schema found for command: ${commandName}`,
      };
    }

    // Extract options from interaction
    const options: Record<string, any> = {};

    if (interaction.isChatInputCommand()) {
      interaction.options.data.forEach(option => {
        options[option.name] = option.value;
      });
    }

    // Validate with Zod
    const result = schema.safeParse(options);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      logger.warn(`Validation failed for command ${commandName}:`, {
        errors: result.error.errors,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });

      // Track failed validation
      await securityMonitor.trackFailedValidation(interaction.user.id);

      return {
        success: false,
        error: 'Invalid command parameters',
        details: result.error,
      };
    }
  } catch (error) {
    logger.error(`Validation error for command ${commandName}:`, error);
    return {
      success: false,
      error: 'An error occurred during validation',
    };
  }
}

/**
 * Performs security checks on the interaction
 */
export async function performSecurityChecks(interaction: CommandInteraction): Promise<SecurityCheckResult> {
  const checks: SecurityCheckResult = { passed: true };

  // Check 1: User account age
  const accountAge = Date.now() - interaction.user.createdTimestamp;
  const minAccountAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  if (accountAge < minAccountAge) {
    logger.warn('New account attempting to use commands:', {
      userId: interaction.user.id,
      accountAge: Math.floor(accountAge / 1000 / 60 / 60), // hours
      username: interaction.user.username,
    });
    checks.suspicious = true;
  }

  // Check 2: Guild member duration (if in a guild)
  if (interaction.inGuild() && interaction.member) {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (member?.joinedTimestamp) {
      const memberDuration = Date.now() - member.joinedTimestamp;
      const minMemberDuration = 10 * 60 * 1000; // 10 minutes

      if (memberDuration < minMemberDuration) {
        logger.warn('Very new guild member attempting to use commands:', {
          userId: interaction.user.id,
          guildId: interaction.guildId,
          memberDuration: Math.floor(memberDuration / 1000), // seconds
          username: interaction.user.username,
        });
        checks.suspicious = true;
      }
    }
  }

  // Check 3: Detect suspicious patterns in username
  const suspiciousPatterns = [
    /discord\.gg/i,
    /bit\.ly/i,
    /tinyurl/i,
    /free.*nitro/i,
    /steam.*gift/i,
    /@everyone/,
    /@here/,
  ];

  const username = interaction.user.username;
  const hasSuspiciousUsername = suspiciousPatterns.some(pattern => pattern.test(username));

  if (hasSuspiciousUsername) {
    logger.warn('Suspicious username pattern detected:', {
      userId: interaction.user.id,
      username: interaction.user.username,
      guildId: interaction.guildId,
    });
    checks.suspicious = true;
  }

  // Check 4: Bot detection
  if (interaction.user.bot) {
    checks.passed = false;
    checks.reason = 'Bots cannot use this command';
  }

  return checks;
}

/**
 * Main validation middleware for Discord commands
 */
export async function validateInteraction(
  interaction: CommandInteraction,
  options?: {
    skipRateLimit?: boolean;
    skipSecurity?: boolean;
    customRateLimitConfig?: any;
  }
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check if user is blocked
    const blockStatus = await securityMonitor.isUserBlocked(interaction.user.id);
    if (blockStatus.blocked) {
      await interaction.reply({
        content: `You have been temporarily blocked. Reason: ${blockStatus.reason ?? 'Suspicious activity detected'}`,
        flags: MessageFlags.Ephemeral,
      });
      return { valid: false, error: 'User blocked' };
    }

    // Track command usage
    await securityMonitor.trackCommandUsage(interaction);
    // Security checks
    if (!options?.skipSecurity) {
      const securityCheck = await performSecurityChecks(interaction);

      if (!securityCheck.passed) {
        await interaction.reply({
          content: securityCheck.reason ?? 'Security check failed',
          flags: MessageFlags.Ephemeral,
        });
        return { valid: false, error: securityCheck.reason };
      }

      // Apply stricter rate limits for suspicious users
      if (securityCheck.suspicious && !options?.skipRateLimit) {
        const suspiciousLimit = await rateLimiters.user.checkLimit(interaction.user.id, {
          ...rateLimitConfigs.suspicious,
          keyPrefix: 'suspicious',
        });

        if (!suspiciousLimit.allowed) {
          logger.warn('Suspicious user rate limited:', {
            userId: interaction.user.id,
            username: interaction.user.username,
            retryAfter: suspiciousLimit.retryAfter,
          });

          await interaction.reply({
            content: `You are being rate limited. Please try again in ${suspiciousLimit.retryAfter} seconds.`,
            flags: MessageFlags.Ephemeral,
          });
          return { valid: false, error: 'Rate limited (suspicious activity)' };
        }
      }
    }

    // Check for abuse patterns
    const abusePatterns = await securityMonitor.checkAbusePatterns(interaction);
    if (abusePatterns.length > 0 && abusePatterns.some(p => p.severity === 'high')) {
      logger.warn('High severity abuse pattern detected:', {
        userId: interaction.user.id,
        patterns: abusePatterns,
      });
    }

    // Rate limiting
    if (!options?.skipRateLimit) {
      // Per-user rate limit
      const userRateLimit = await rateLimiters.user.checkLimit(
        interaction.user.id,
        options?.customRateLimitConfig ?? rateLimitConfigs.charts
      );

      if (!userRateLimit.allowed) {
        await interaction.reply({
          content: `You are being rate limited. Please try again in ${userRateLimit.retryAfter} seconds.`,
          flags: MessageFlags.Ephemeral,
        });
        return { valid: false, error: 'User rate limited' };
      }

      // Per-guild rate limit (if in a guild)
      if (interaction.guildId) {
        const guildRateLimit = await rateLimiters.guild.checkLimit(interaction.guildId, {
          ...rateLimitConfigs.guild,
          keyPrefix: 'guild',
        });

        if (!guildRateLimit.allowed) {
          await interaction.reply({
            content: 'This server is being rate limited. Please try again later.',
            flags: MessageFlags.Ephemeral,
          });
          return { valid: false, error: 'Guild rate limited' };
        }
      }
    }

    return { valid: true };
  } catch (error) {
    logger.error('Error in validation middleware:', error);
    return { valid: false, error: 'Validation error occurred' };
  }
}

/**
 * Sanitizes user input to prevent injection attacks
 */
export function sanitizeInput(input: string, maxLength: number = 100): string {
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove control characters except newlines and tabs
  // Remove control characters except newlines and tabs
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Logs command usage for monitoring
 */
export function logCommandUsage(interaction: CommandInteraction, success: boolean, error?: string): void {
  const logData = {
    userId: interaction.user.id,
    username: interaction.user.username,
    command: interaction.commandName,
    subcommand: interaction.isChatInputCommand() ? interaction.options.getSubcommand(false) : undefined,
    guildId: interaction.guildId,
    guildName: interaction.guild?.name,
    channelId: interaction.channelId,
    success,
    error,
    timestamp: new Date().toISOString(),
  };

  if (success) {
    logger.info('Command executed successfully:', logData);
  } else {
    logger.warn('Command execution failed:', logData);
  }

  // Log suspicious patterns for analysis
  if ((error?.includes('suspicious') ?? false) || (error?.includes('rate limit') ?? false)) {
    logger.warn('Potential abuse detected:', {
      ...logData,
      userCreatedAt: interaction.user.createdAt,
      memberJoinedAt: interaction.inGuild()
        ? interaction.guild?.members.cache.get(interaction.user.id)?.joinedAt
        : undefined,
    });
  }
}
