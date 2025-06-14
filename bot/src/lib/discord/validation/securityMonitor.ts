import { CommandInteraction } from 'discord.js';
import { logger } from '../../logger';
import { redis } from '../../../infrastructure/cache/redis-client';

export interface SuspiciousActivity {
  userId: string;
  username: string;
  guildId?: string;
  pattern: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  details?: Record<string, any>;
}

export class SecurityMonitor {
  private readonly SUSPICIOUS_KEY_PREFIX = 'security:suspicious';
  private readonly ABUSE_KEY_PREFIX = 'security:abuse';
  private readonly MONITOR_WINDOW = 3600000; // 1 hour

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(activity: SuspiciousActivity): Promise<void> {
    const key = `${this.SUSPICIOUS_KEY_PREFIX}:${activity.userId}`;

    try {
      // Store in Redis for tracking
      await redis.zadd(key, Date.now(), JSON.stringify(activity));

      // Set expiry
      await redis.expire(key, 86400); // 24 hours

      // Log to application logs
      logger.warn('Suspicious activity detected:', {
        ...activity,
        timestamp: activity.timestamp.toISOString(),
      });

      // Check if user should be auto-blocked
      await this.checkAutoBlock(activity.userId);
    } catch (error) {
      logger.error('Failed to log suspicious activity:', error);
    }
  }

  /**
   * Check for abuse patterns
   */
  async checkAbusePatterns(interaction: CommandInteraction): Promise<SuspiciousActivity[]> {
    const patterns: SuspiciousActivity[] = [];
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const guildId = interaction.guildId ?? undefined;

    // Pattern 1: Rapid command usage across multiple guilds
    const recentGuilds = await this.getRecentGuilds(userId);
    if (recentGuilds.size > 5) {
      patterns.push({
        userId,
        username,
        guildId,
        pattern: 'rapid_multi_guild_usage',
        severity: 'medium',
        timestamp: new Date(),
        details: {
          guildCount: recentGuilds.size,
          guilds: Array.from(recentGuilds),
        },
      });
    }

    // Pattern 2: Command flooding
    const commandCount = await this.getRecentCommandCount(userId);
    if (commandCount > 50) {
      patterns.push({
        userId,
        username,
        guildId,
        pattern: 'command_flooding',
        severity: 'high',
        timestamp: new Date(),
        details: {
          commandCount,
          timeWindow: '1 hour',
        },
      });
    }

    // Pattern 3: Failed validation attempts
    const failedAttempts = await this.getFailedValidationCount(userId);
    if (failedAttempts > 10) {
      patterns.push({
        userId,
        username,
        guildId,
        pattern: 'excessive_failed_validations',
        severity: 'medium',
        timestamp: new Date(),
        details: {
          failedAttempts,
        },
      });
    }

    // Pattern 4: Suspicious timing patterns (e.g., exact intervals)
    const timingPattern = await this.checkTimingPatterns(userId);
    if (timingPattern.suspicious) {
      patterns.push({
        userId,
        username,
        guildId,
        pattern: 'suspicious_timing',
        severity: 'low',
        timestamp: new Date(),
        details: timingPattern.details,
      });
    }

    // Log all detected patterns
    for (const pattern of patterns) {
      await this.logSuspiciousActivity(pattern);
    }

    return patterns;
  }

  /**
   * Get recent guilds a user has used commands in
   */
  private async getRecentGuilds(userId: string): Promise<Set<string>> {
    const key = `${this.ABUSE_KEY_PREFIX}:guilds:${userId}`;
    const guilds = new Set<string>();

    try {
      const recentActivity = await redis.zrangebyscore(key, Date.now() - this.MONITOR_WINDOW, Date.now());

      recentActivity.forEach(entry => {
        try {
          const data = JSON.parse(entry);
          if (data.guildId) guilds.add(data.guildId);
        } catch (e) {
          // Ignore parse errors
        }
      });
    } catch (error) {
      logger.error('Failed to get recent guilds:', error);
    }

    return guilds;
  }

  /**
   * Get recent command count for a user
   */
  private async getRecentCommandCount(userId: string): Promise<number> {
    const key = `${this.ABUSE_KEY_PREFIX}:commands:${userId}`;

    try {
      const count = await redis.zcount(key, Date.now() - this.MONITOR_WINDOW, Date.now());
      return count;
    } catch (error) {
      logger.error('Failed to get command count:', error);
      return 0;
    }
  }

  /**
   * Get failed validation count for a user
   */
  private async getFailedValidationCount(userId: string): Promise<number> {
    const key = `${this.ABUSE_KEY_PREFIX}:failed:${userId}`;

    try {
      const count = await redis.get(key);
      return parseInt(count ?? '0', 10);
    } catch (error) {
      logger.error('Failed to get failed validation count:', error);
      return 0;
    }
  }

  /**
   * Check for suspicious timing patterns
   */
  private async checkTimingPatterns(userId: string): Promise<{
    suspicious: boolean;
    details?: Record<string, any>;
  }> {
    const key = `${this.ABUSE_KEY_PREFIX}:timing:${userId}`;

    try {
      // Get recent command timestamps
      const timestamps = await redis.zrangebyscore(key, Date.now() - this.MONITOR_WINDOW, Date.now(), 'WITHSCORES');

      if (timestamps.length < 10) {
        return { suspicious: false };
      }

      // Extract just the scores (timestamps)
      const times: number[] = [];
      for (let i = 1; i < timestamps.length; i += 2) {
        times.push(parseFloat(timestamps[i]));
      }

      // Calculate intervals
      const intervals: number[] = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i - 1]);
      }

      // Check for exact intervals (bot-like behavior)
      const intervalCounts = new Map<number, number>();
      intervals.forEach(interval => {
        const rounded = Math.round(interval / 1000) * 1000; // Round to nearest second
        intervalCounts.set(rounded, (intervalCounts.get(rounded) ?? 0) + 1);
      });

      // If more than 50% of intervals are the same, it's suspicious
      const maxCount = Math.max(...intervalCounts.values());
      const suspicious = maxCount > intervals.length * 0.5;

      return {
        suspicious,
        details: suspicious
          ? {
              totalCommands: times.length,
              commonInterval: Array.from(intervalCounts.entries()).find(([, count]) => count === maxCount)?.[0],
              intervalDistribution: Object.fromEntries(intervalCounts),
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Failed to check timing patterns:', error);
      return { suspicious: false };
    }
  }

  /**
   * Check if user should be auto-blocked based on suspicious activity
   */
  private async checkAutoBlock(userId: string): Promise<void> {
    const key = `${this.SUSPICIOUS_KEY_PREFIX}:${userId}`;

    try {
      // Get recent suspicious activities
      const activities = await redis.zrangebyscore(key, Date.now() - this.MONITOR_WINDOW, Date.now());

      let severityScore = 0;
      activities.forEach(activityStr => {
        try {
          const activity: SuspiciousActivity = JSON.parse(activityStr);
          switch (activity.severity) {
            case 'high':
              severityScore += 3;
              break;
            case 'medium':
              severityScore += 2;
              break;
            case 'low':
              severityScore += 1;
              break;
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      // Auto-block if severity score is too high
      if (severityScore >= 10) {
        await this.blockUser(userId, 'Automatic block due to suspicious activity');
      }
    } catch (error) {
      logger.error('Failed to check auto-block:', error);
    }
  }

  /**
   * Block a user from using commands
   */
  async blockUser(userId: string, reason: string): Promise<void> {
    const key = `${this.ABUSE_KEY_PREFIX}:blocked:${userId}`;

    try {
      await redis.set(
        key,
        JSON.stringify({
          reason,
          timestamp: new Date().toISOString(),
          blockedBy: 'system',
        }),
        'EX',
        86400
      ); // 24 hour block

      logger.warn('User blocked:', {
        userId,
        reason,
      });
    } catch (error) {
      logger.error('Failed to block user:', error);
    }
  }

  /**
   * Check if a user is blocked
   */
  async isUserBlocked(userId: string): Promise<{ blocked: boolean; reason?: string }> {
    const key = `${this.ABUSE_KEY_PREFIX}:blocked:${userId}`;

    try {
      const blockData = await redis.get(key);
      if (blockData) {
        const parsed = JSON.parse(blockData);
        return { blocked: true, reason: parsed.reason };
      }
      return { blocked: false };
    } catch (error) {
      logger.error('Failed to check user block status:', error);
      return { blocked: false };
    }
  }

  /**
   * Track command usage for monitoring
   */
  async trackCommandUsage(interaction: CommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      // Track guilds
      if (guildId) {
        const guildKey = `${this.ABUSE_KEY_PREFIX}:guilds:${userId}`;
        await redis.zadd(guildKey, Date.now(), JSON.stringify({ guildId }));
        await redis.expire(guildKey, 3600); // 1 hour
      }

      // Track command count
      const commandKey = `${this.ABUSE_KEY_PREFIX}:commands:${userId}`;
      await redis.zadd(commandKey, Date.now(), interaction.id);
      await redis.expire(commandKey, 3600); // 1 hour

      // Track timing
      const timingKey = `${this.ABUSE_KEY_PREFIX}:timing:${userId}`;
      await redis.zadd(timingKey, Date.now(), interaction.id);
      await redis.expire(timingKey, 3600); // 1 hour
    } catch (error) {
      logger.error('Failed to track command usage:', error);
    }
  }

  /**
   * Track failed validation
   */
  async trackFailedValidation(userId: string): Promise<void> {
    const key = `${this.ABUSE_KEY_PREFIX}:failed:${userId}`;

    try {
      await redis.incr(key);
      await redis.expire(key, 3600); // 1 hour
    } catch (error) {
      logger.error('Failed to track failed validation:', error);
    }
  }
}

// Export singleton instance
export const securityMonitor = new SecurityMonitor();
