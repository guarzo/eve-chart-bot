import { BaseChartGenerator } from '../BaseChartGenerator';
import { ChartData, ChartDisplayTypeEnum } from '../../../types/chart';
import { logger } from '../../../lib/logger';
import { KillsChartConfig } from '../config/KillsChartConfig';
import { KillRepository } from '../../../infrastructure/repositories/KillRepository';
import { RepositoryManager } from '../../../infrastructure/repositories/RepositoryManager';
import { errorHandler, ChartError, ValidationError } from '../../../shared/errors';
import { BigIntTransformer } from '../../../shared/utilities/BigIntTransformer';
// import { KillChartData, AttackerData } from '../../../shared/types'; // Unused imports
import { Killmail, KillmailAttacker } from '../../../domain/killmail/Killmail';

/**
 * Generator for kill-related charts
 */
export class KillsChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;

  /**
   * Create a new kills chart generator
   * @param repoManager Repository manager for data access
   */
  constructor(repoManager: RepositoryManager) {
    super(repoManager);
    this.killRepository = this.repoManager.getKillRepository();
  }

  /**
   * Generate a kills chart based on the provided options
   */
  async generateChart(options: {
    startDate: Date;
    endDate: Date;
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>;
    displayType: string;
  }): Promise<ChartData> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      const { startDate, endDate, characterGroups } = options;

      // Input validation
      this.validateChartOptions(options, correlationId);

      logger.info(`KillsChartGenerator: Processing ${characterGroups.length} character groups`, { correlationId });
      logger.info(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`, { correlationId });

      // Get all character IDs from all groups using standardized transformer
      const characterIds = characterGroups.flatMap(group => BigIntTransformer.migrateCharacterIds(group.characters));

      logger.info(`Total characters across all groups: ${characterIds.length}`, { correlationId });

      // Get kills for all characters with retry logic
      const kills = await errorHandler.withRetry(
        () => this.killRepository.getAllKillsForCharacters(characterIds, startDate, endDate),
        3,
        1000,
        { operation: 'fetchKillsData', correlationId, metadata: { characterCount: characterIds.length } }
      );

      logger.info(`Found ${kills.length} total kills across all characters (including as attackers)`, {
        correlationId,
      });

      // Check if we have any data to work with
      if (kills.length === 0) {
        logger.warn('No kills found for the specified time period and characters', { correlationId });
        throw new ChartError('CHART_DATA_ERROR', 'No kills found in the specified time period', 'kills', {
          correlationId,
          metadata: { startDate, endDate, characterCount: characterIds.length },
        });
      }

      // Debug: Log the first few kills to see their structure
      if (kills.length > 0) {
        logger.info('Sample kill data structure:', { correlationId });
        kills.slice(0, 3).forEach((kill, index) => {
          logger.info(`Kill ${index + 1}:`, { correlationId });
          logger.info(
            `  killmailId: ${BigIntTransformer.forLogging(kill.killmailId)} (type: ${typeof kill.killmailId})`,
            { correlationId }
          );
          logger.info(`  victim: ${JSON.stringify(kill.victim)} (type: ${typeof kill.victim})`, { correlationId });
          logger.info(`  attackers_count: ${kill.attackers?.length ?? 0}`, { correlationId });
          logger.info(`  all_keys: ${Object.keys(kill).join(', ')}`, { correlationId });
          if (kill.attackers?.[0]) {
            logger.info(`  first_attacker: ${JSON.stringify(kill.attackers[0])}`, { correlationId });
            logger.info(`  first_attacker_keys: ${Object.keys(kill.attackers[0]).join(', ')}`, { correlationId });
          }
        });
      }

      // Debug: Log character IDs we're looking for using standardized transformer
      logger.info(
        `Character IDs we're looking for: ${BigIntTransformer.arrayToStringArray(characterIds.slice(0, 5)).join(', ')}`,
        { correlationId }
      );

      // Log distribution of kills across characters
      const killsByCharacter = new Map<string, number>();
      kills.forEach(kill => {
        // Count kills by attackers (those who participated in the kill)
        if (kill.attackers) {
          kill.attackers.forEach((attacker: any) => {
            if (attacker.characterId !== null && attacker.characterId !== undefined) {
              const charId = BigIntTransformer.forLogging(attacker.characterId);
              killsByCharacter.set(charId, (killsByCharacter.get(charId) ?? 0) + 1);
            }
          });
        }
      });

      logger.info(`Kill distribution: ${killsByCharacter.size} characters have kills as main killer`, {
        correlationId,
      });
      logger.info(
        `Characters with most kills as main: ${Array.from(killsByCharacter.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([charId, count]) => `${charId}:${count}`)
          .join(', ')}`,
        { correlationId }
      );

      // Group kills by character group, but now include any kill where a group member is on the killmail
      const groupData = characterGroups.map(group => {
        const groupName = this.getGroupDisplayName(group);
        const groupCharacterIds = BigIntTransformer.migrateCharacterIds(group.characters);

        // Use a Set to track unique killmail IDs to avoid double-counting
        const uniqueGroupKillIds = new Set<string>();

        // A kill belongs to the group if:
        // 1. The main character on the kill is in the group, OR
        // 2. Any of the attackers are in the group
        kills.forEach((kill: Killmail) => {
          const killmailIdStr = BigIntTransformer.forLogging(kill.killmailId);
          if (!killmailIdStr) return;

          // Skip if we've already counted this killmail
          if (uniqueGroupKillIds.has(killmailIdStr)) {
            return;
          }

          // Debug for first group only to avoid spam
          const isFirstGroup = group === characterGroups[0];

          // Check if any attackers are in group (kills are attributed to attackers)
          if (kill.attackers && kill.attackers.length > 0) {
            for (const attacker of kill.attackers) {
              if (!attacker.characterId) continue;

              const attackerCharId = BigInt(attacker.characterId);
              if (groupCharacterIds.includes(attackerCharId)) {
                if (isFirstGroup && kills.indexOf(kill) < 3) {
                  logger.info(`Found attacker match in kill ${killmailIdStr}: attacker=${attacker.characterId}`);
                }
                uniqueGroupKillIds.add(killmailIdStr);
                return;
              }
            }
          }

          // Also check if victim is in group (for loss tracking)
          if (kill.victim?.characterId !== null && kill.victim?.characterId !== undefined) {
            const victimCharId = BigInt(kill.victim.characterId);
            const isVictimInGroup = groupCharacterIds.includes(victimCharId);

            if (isFirstGroup && kills.indexOf(kill) < 3) {
              logger.info(
                `Checking kill ${killmailIdStr}: victim=${kill.victim.characterId}, isInGroup=${isVictimInGroup}`
              );
            }

            if (isVictimInGroup) {
              uniqueGroupKillIds.add(killmailIdStr);
              return;
            }
          }
        });

        // Now get the actual kill objects for the unique IDs
        const groupKills = kills.filter((kill: Killmail) => {
          const killmailIdStr = BigIntTransformer.forLogging(kill.killmailId);
          return killmailIdStr && uniqueGroupKillIds.has(killmailIdStr);
        });

        // Calculate total kills using the unique count
        const totalKills = uniqueGroupKillIds.size;

        logger.info(`Group ${groupName}: ${totalKills} unique kills, ${group.characters.length} characters`, {
          correlationId,
        });

        if (groupKills.length > 0) {
          // List the first few character IDs that have kills in this group
          const characterIdsWithKills = new Set<string>();
          groupKills.forEach(kill => {
            if (kill.attackers) {
              kill.attackers.forEach((attacker: any) => {
                if (attacker.characterId !== null && attacker.characterId !== undefined) {
                  characterIdsWithKills.add(attacker.characterId.toString());
                }
              });
            }
          });
          logger.info(
            `Characters with kills in group ${groupName}: ${Array.from(characterIdsWithKills)
              .slice(0, 3)
              .join(', ')}${characterIdsWithKills.size > 3 ? '...' : ''} (${characterIdsWithKills.size} total)`
          );
        }

        // Calculate solo kills - either true solo (1 attacker) or group solo (all attackers from same group)
        let soloKills = 0;
        for (const kill of groupKills) {
          // Skip kills with no attackers
          if (!kill.attackers || kill.attackers.length === 0) continue;

          // Get all player attackers (those with character IDs)
          const playerAttackers =
            kill.attackers?.filter((a: KillmailAttacker) => a.characterId !== null && a.characterId !== undefined) ||
            [];
          if (playerAttackers.length === 0) continue;

          // Count as solo if either:
          // 1. It's a true solo kill (only one player attacker)
          // 2. All player attackers are from this group
          const isTrueSolo = playerAttackers.length === 1;
          const allFromGroup = playerAttackers.every((attacker: KillmailAttacker) => {
            if (!attacker.characterId) return false;
            return groupCharacterIds.includes(BigInt(attacker.characterId));
          });

          if (isTrueSolo || allFromGroup) {
            soloKills++;
            const killmailIdStr = kill.killmailId?.toString() ?? 'unknown';
            logger.info(
              `Found ${isTrueSolo ? 'true' : 'group'} solo kill for group ${groupName}: Kill ID ${killmailIdStr} - ${
                playerAttackers.length
              } player attackers`
            );
          }
        }

        return {
          group,
          kills: groupKills,
          totalKills,
          soloKills,
        };
      });

      // Log all group data before filtering
      groupData.forEach(data => {
        const groupName = this.getGroupDisplayName(data.group);
        logger.info(`Group ${groupName}: ${data.totalKills} total kills, ${data.soloKills} solo kills`, {
          correlationId,
        });
      });

      // Filter out groups with no kills
      const groupsWithKills = groupData.filter(data => data.totalKills > 0);

      logger.info(`Filtered to ${groupsWithKills.length} groups with kills out of ${groupData.length} total groups`, {
        correlationId,
      });

      // List the groups that were filtered out
      const filteredOutGroups = groupData
        .filter(data => data.totalKills === 0)
        .map(data => this.getGroupDisplayName(data.group));

      if (filteredOutGroups.length > 0) {
        logger.info(
          `Groups with no kills: ${filteredOutGroups.slice(0, 5).join(', ')}${
            filteredOutGroups.length > 5 ? '...' : ''
          } (${filteredOutGroups.length} total)`,
          { correlationId }
        );
      }

      // If no groups have kills, return empty chart
      if (groupsWithKills.length === 0) {
        logger.info('No groups with kills found, returning empty chart', { correlationId });
        return {
          labels: [],
          datasets: [],
          displayType: ChartDisplayTypeEnum.HORIZONTAL_BAR,
          summary: 'No kills found in the specified time period',
        };
      }

      // Sort groups by total kills
      groupsWithKills.sort((a, b) => b.totalKills - a.totalKills);

      logger.info(
        `Top 5 groups by kill count: ${groupsWithKills
          .slice(0, 5)
          .map(g => `${this.getGroupDisplayName(g.group)}: ${g.totalKills}`)
          .join(', ')}`,
        { correlationId }
      );

      // Create chart data
      return {
        labels: groupsWithKills.map(data => this.getGroupDisplayName(data.group)),
        datasets: [
          {
            label: 'Total Kills',
            data: groupsWithKills.map(data => data.totalKills),
            backgroundColor: this.getDatasetColors('kills').primary,
          },
          {
            label: 'Solo Kills',
            data: groupsWithKills.map(data => data.soloKills),
            backgroundColor: this.getDatasetColors('kills').secondary,
          },
        ],
        displayType: 'horizontalBar',
        options: {
          indexAxis: 'y',
          scales: {
            x: {
              stacked: true,
              beginAtZero: true,
            },
            y: {
              stacked: true,
            },
          },
          plugins: {
            legend: {
              position: 'top',
            },
          },
        },
        summary: KillsChartConfig.getDefaultSummary(
          groupsWithKills.reduce((total, data) => total + data.totalKills, 0),
          groupsWithKills.reduce((total, data) => total + data.soloKills, 0)
        ),
      };
    } catch (error) {
      logger.error('Error generating kills chart', {
        error,
        correlationId,
        context: {
          operation: 'generateKillsChart',
          hasOptions: !!options,
          characterGroupCount: options?.characterGroups?.length || 0,
        },
      });

      if (error instanceof ChartError || error instanceof ValidationError) {
        throw error;
      }

      throw new ChartError(
        'CHART_GENERATION_ERROR',
        'Failed to generate kills chart',
        'kills',
        {
          correlationId,
          operation: 'generateKillsChart',
        },
        error as Error
      );
    }
  }

  /**
   * Validate chart generation options
   */
  private validateChartOptions(
    options: {
      startDate: Date;
      endDate: Date;
      characterGroups: Array<{
        groupId: string;
        name: string;
        characters: Array<{ eveId: string; name: string }>;
        mainCharacterId?: string;
      }>;
      displayType: string;
    },
    correlationId: string
  ): void {
    const issues: Array<{ field: string; value: any; constraint: string; message: string }> = [];

    // Validate dates
    if (!options.startDate || !(options.startDate instanceof Date) || isNaN(options.startDate.getTime())) {
      issues.push({ field: 'startDate', value: options.startDate, constraint: 'date', message: 'Invalid start date' });
    }

    if (!options.endDate || !(options.endDate instanceof Date) || isNaN(options.endDate.getTime())) {
      issues.push({ field: 'endDate', value: options.endDate, constraint: 'date', message: 'Invalid end date' });
    }

    if (options.startDate && options.endDate && options.startDate >= options.endDate) {
      issues.push({
        field: 'dateRange',
        value: { startDate: options.startDate, endDate: options.endDate },
        constraint: 'comparison',
        message: 'Start date must be before end date',
      });
    }

    // Validate character groups
    if (!options.characterGroups || !Array.isArray(options.characterGroups)) {
      issues.push({
        field: 'characterGroups',
        value: options.characterGroups,
        constraint: 'array',
        message: 'Character groups must be an array',
      });
    } else {
      if (options.characterGroups.length === 0) {
        issues.push({
          field: 'characterGroups',
          value: options.characterGroups,
          constraint: 'minLength',
          message: 'At least one character group is required',
        });
      }

      options.characterGroups.forEach((group, index) => {
        if (!group.groupId || typeof group.groupId !== 'string') {
          issues.push({
            field: `characterGroups[${index}].groupId`,
            value: group.groupId,
            constraint: 'required',
            message: 'Group ID is required',
          });
        }

        if (!group.name || typeof group.name !== 'string') {
          issues.push({
            field: `characterGroups[${index}].name`,
            value: group.name,
            constraint: 'required',
            message: 'Group name is required',
          });
        }

        if (!group.characters || !Array.isArray(group.characters)) {
          issues.push({
            field: `characterGroups[${index}].characters`,
            value: group.characters,
            constraint: 'array',
            message: 'Characters must be an array',
          });
        } else {
          group.characters.forEach((char, charIndex) => {
            if (!char.eveId || typeof char.eveId !== 'string') {
              issues.push({
                field: `characterGroups[${index}].characters[${charIndex}].eveId`,
                value: char.eveId,
                constraint: 'required',
                message: 'Character eveId is required',
              });
            }
            if (!char.name || typeof char.name !== 'string') {
              issues.push({
                field: `characterGroups[${index}].characters[${charIndex}].name`,
                value: char.name,
                constraint: 'required',
                message: 'Character name is required',
              });
            }
          });
        }
      });
    }

    if (issues.length > 0) {
      throw new ValidationError('Invalid chart generation options', issues, {
        correlationId,
        operation: 'validateKillsChartOptions',
      });
    }
  }
}
