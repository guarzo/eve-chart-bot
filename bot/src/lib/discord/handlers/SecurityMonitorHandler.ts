import { CommandInteraction, MessageFlags, EmbedBuilder } from 'discord.js';
import { logger } from '../../logger';
import { redis } from '../../../infrastructure/cache/redis-client';

/**
 * Handler for security monitoring commands (admin only)
 */
export class SecurityMonitorHandler {
  private readonly ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',') ?? [];

  async handle(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    // Check if user is admin
    if (!this.isAdmin(interaction.user.id)) {
      await interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      switch (subcommand) {
        case 'status':
          await this.handleStatus(interaction);
          break;
        case 'suspicious':
          await this.handleSuspicious(interaction);
          break;
        case 'blocked':
          await this.handleBlocked(interaction);
          break;
        case 'unblock':
          await this.handleUnblock(interaction);
          break;
        default:
          await interaction.editReply('Unknown security subcommand');
      }
    } catch (error) {
      logger.error('Error in security monitor handler:', error);
      await interaction.editReply('An error occurred while processing the command.');
    }
  }

  private isAdmin(userId: string): boolean {
    return this.ADMIN_USER_IDS.includes(userId);
  }

  private async handleStatus(interaction: CommandInteraction): Promise<void> {
    const embed = new EmbedBuilder().setTitle('Security Monitor Status').setColor(0x00aa00).setTimestamp();

    // Get rate limit stats
    const userLimitKeys = await redis.keys('ratelimit:*');
    const guildLimitKeys = await redis.keys('guild:*');
    const suspiciousKeys = await redis.keys('suspicious:*');

    embed.addFields([
      {
        name: 'Rate Limits',
        value: `Active user limits: ${userLimitKeys.length}\nActive guild limits: ${guildLimitKeys.length}\nSuspicious users: ${suspiciousKeys.length}`,
        inline: true,
      },
    ]);

    // Get blocked users count
    const blockedKeys = await redis.keys('security:abuse:blocked:*');
    embed.addFields([
      {
        name: 'Blocked Users',
        value: `Currently blocked: ${blockedKeys.length}`,
        inline: true,
      },
    ]);

    // Get recent suspicious activity count
    const recentSuspicious = await redis.keys('security:suspicious:*');
    let highSeverityCount = 0;

    for (const key of recentSuspicious.slice(0, 10)) {
      const activities = await redis.zrange(key, -10, -1);
      for (const activity of activities) {
        try {
          const parsed = JSON.parse(activity);
          if (parsed.severity === 'high') highSeverityCount++;
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    embed.addFields([
      {
        name: 'Recent Activity',
        value: `High severity incidents: ${highSeverityCount}`,
        inline: true,
      },
    ]);

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleSuspicious(interaction: CommandInteraction): Promise<void> {
    const embed = new EmbedBuilder().setTitle('Recent Suspicious Activity').setColor(0xffaa00).setTimestamp();

    const suspiciousKeys = await redis.keys('security:suspicious:*');
    const recentActivities: any[] = [];

    // Get recent suspicious activities
    for (const key of suspiciousKeys.slice(0, 5)) {
      const userId = key.split(':').pop();
      const activities = await redis.zrange(key, -5, -1);

      for (const activity of activities) {
        try {
          const parsed = JSON.parse(activity);
          recentActivities.push({
            ...parsed,
            userId,
          });
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    // Sort by timestamp and take most recent
    recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const topActivities = recentActivities.slice(0, 10);

    if (topActivities.length === 0) {
      embed.setDescription('No recent suspicious activity detected.');
    } else {
      for (const activity of topActivities) {
        const timestamp = new Date(activity.timestamp).toLocaleTimeString();
        embed.addFields([
          {
            name: `${activity.username} (${activity.userId})`,
            value: `Pattern: ${activity.pattern}\nSeverity: ${activity.severity}\nTime: ${timestamp}`,
            inline: false,
          },
        ]);
      }
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleBlocked(interaction: CommandInteraction): Promise<void> {
    const embed = new EmbedBuilder().setTitle('Blocked Users').setColor(0xff0000).setTimestamp();

    const blockedKeys = await redis.keys('security:abuse:blocked:*');

    if (blockedKeys.length === 0) {
      embed.setDescription('No users are currently blocked.');
    } else {
      for (const key of blockedKeys.slice(0, 10)) {
        const userId = key.split(':').pop();
        const blockData = await redis.get(key);

        if (blockData) {
          try {
            const parsed = JSON.parse(blockData);
            const ttl = await redis.ttl(key);
            embed.addFields([
              {
                name: `User ID: ${userId}`,
                value: `Reason: ${parsed.reason}\nExpires in: ${Math.floor(ttl / 60)} minutes`,
                inline: false,
              },
            ]);
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleUnblock(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      await interaction.editReply('This command can only be used as a chat input command.');
      return;
    }

    const userId = interaction.options.getString('user');

    if (!userId) {
      await interaction.editReply('Please provide a user ID to unblock.');
      return;
    }

    const key = `security:abuse:blocked:${userId}`;
    const existed = await redis.del(key);

    if (existed) {
      logger.info(`User ${userId} unblocked by ${interaction.user.tag}`);
      await interaction.editReply(`Successfully unblocked user ${userId}.`);
    } else {
      await interaction.editReply(`User ${userId} was not blocked.`);
    }
  }
}
