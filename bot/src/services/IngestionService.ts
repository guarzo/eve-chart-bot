import { PrismaClient } from "@prisma/client";
import { ZkillClient } from "../lib/api/ZkillClient";
import { MapClient } from "../lib/api/MapClient";
import { RedisCache } from "../lib/cache/RedisCache";
import {
  IngestionConfig,
  KillFact,
  MapActivity,
  Character,
  ZkillResponseSchema,
} from "../types/ingestion";
import { logger } from "../lib/logger";
import { Redis } from "ioredis";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";

// Initialize Prisma with minimal configuration
const prisma = new PrismaClient();

// Log queries in development
if (process.env.NODE_ENV === "development") {
  prisma.$on("query" as never, (e: any) => {
    logger.debug("Query: " + e.query);
    logger.debug("Duration: " + e.duration + "ms");
  });
}

interface ZkillKillmail {
  killmail_id: number;
  killmail_time: string;
  solar_system_id: number;
  victim: {
    character_id?: number;
    corporation_id?: number;
    alliance_id?: number;
    ship_type_id: number;
    damage_taken: number;
    position: { x: number; y: number; z: number };
    items: Array<{
      type_id: number;
      flag: number;
      quantity_destroyed?: number;
      quantity_dropped?: number;
      singleton: number;
    }>;
  };
  attackers: Array<{
    character_id?: number;
    corporation_id?: number;
    alliance_id?: number;
    damage_done: number;
    final_blow: boolean;
    security_status: number;
    ship_type_id: number;
    weapon_type_id: number;
  }>;
  zkb: {
    totalValue: number;
    points: number;
    hash: string;
  };
}

interface ESIAttacker {
  character_id?: number;
  corporation_id?: number;
  alliance_id?: number;
  damage_done: number;
  final_blow: boolean;
  security_status: number;
  ship_type_id: number;
  weapon_type_id: number;
}

export class IngestionService {
  public readonly prisma: PrismaClient;
  private zkill: ZkillClient;
  private map: MapClient;
  private cache: RedisCache;
  private config: IngestionConfig;
  private readonly redis: Redis;
  private readonly trackedCharacters: Set<string>;

  constructor(config: IngestionConfig) {
    this.prisma = prisma;
    this.zkill = new ZkillClient(config.zkillApiUrl);
    this.map = new MapClient(
      config.mapApiUrl || process.env.MAP_API_URL || "",
      config.mapApiKey || process.env.MAP_API_KEY || ""
    );
    this.cache = new RedisCache(
      config.redisUrl || process.env.REDIS_URL || "redis://localhost:6379",
      config.cacheTtl || 300
    );
    this.config = {
      ...config,
      cacheTtl: config.cacheTtl || 300,
      batchSize: config.batchSize || 100,
      backoffMs: config.backoffMs || 1000,
      maxRetries: config.maxRetries || 3,
    };
    this.redis = new Redis(
      config.redisUrl || process.env.REDIS_URL || "redis://localhost:6379"
    );
    this.trackedCharacters = new Set();
  }

  async ingestKillmail(killId: number): Promise<{
    success: boolean;
    skipped?: boolean;
    existing?: boolean;
    timestamp?: string;
    age?: number;
    error?: string;
  }> {
    try {
      // Check if we've already processed this killmail
      // Use try/catch to handle potential missing KillFact model in Prisma
      let existing = null;
      try {
        existing = await (this.prisma as any).killFact.findUnique({
          where: { killmail_id: BigInt(killId) },
        });
      } catch (err) {
        logger.warn(
          `Error checking for existing killmail: ${err}, will attempt to continue`
        );
      }

      if (existing) {
        logger.debug(`Killmail ${killId} already processed`);
        return {
          success: false,
          existing: true,
          skipped: true,
        };
      }

      // Get killmail data from zKillboard
      const killmail = await this.zkill.getKillmail(killId);
      if (!killmail) {
        logger.warn(`No killmail data found for ID ${killId}`);
        return {
          success: false,
          skipped: true,
        };
      }

      // Get ESI data for additional details
      const esiData = await this.fetchEsiData(
        killmail.killmail_id,
        killmail.zkb.hash
      );

      // Check if ESI data is valid
      if (!esiData || !esiData.victim) {
        logger.warn(`Invalid ESI data for killmail ${killId}`);
        return {
          success: false,
          skipped: true,
        };
      }

      // Process victim data
      const victim = {
        characterId: esiData.victim.character_id,
        corporationId: esiData.victim.corporation_id,
        allianceId: esiData.victim.alliance_id,
        shipTypeId: esiData.victim.ship_type_id,
        damageTaken: esiData.victim.damage_taken,
      };

      // Process attackers
      const attackers = esiData.attackers.map((attacker: ESIAttacker) => ({
        characterId: attacker.character_id,
        corporationId: attacker.corporation_id,
        allianceId: attacker.alliance_id,
        damageDone: attacker.damage_done,
        finalBlow: attacker.final_blow,
        securityStatus: attacker.security_status,
        shipTypeId: attacker.ship_type_id,
        weaponTypeId: attacker.weapon_type_id,
      }));

      // Create character relationships
      const characterRelations = [
        // Add victim if it's a player
        ...(victim.characterId
          ? [
              {
                characterId: String(victim.characterId),
                role: "victim",
              },
            ]
          : []),
        // Add all attackers
        ...attackers
          .filter((a: { characterId?: number }) => a.characterId)
          .map((a: { characterId: number }) => ({
            characterId: String(a.characterId),
            role: "attacker",
          })),
      ];

      // Check if any of the characters exist in our database
      const trackedCharacters = await this.prisma.character.findMany({
        where: {
          eveId: {
            in: characterRelations.map((r) => r.characterId),
          },
        },
      });

      if (trackedCharacters.length === 0) {
        logger.debug(`No tracked characters involved in killmail ${killId}`);
        return {
          success: false,
          skipped: true,
        };
      }

      // Map of which character is tracked for faster lookup
      const trackedCharacterMap = new Map(
        trackedCharacters.map((char) => [char.eveId, char])
      );

      // Filter attackers and victims to identify which ones are tracked
      const trackedAttackers = attackers.filter(
        (attacker: { characterId?: number }) =>
          attacker.characterId &&
          trackedCharacterMap.has(String(attacker.characterId))
      );

      const isVictimTracked =
        victim.characterId &&
        trackedCharacterMap.has(String(victim.characterId));

      if (trackedAttackers.length === 0 && !isVictimTracked) {
        logger.debug(
          `Neither attacker nor victim is tracked in killmail ${killId}`
        );
        return {
          success: false,
          skipped: true,
        };
      }

      // Try to create kill fact with robust error handling
      let killFact;
      try {
        // Use a transaction to create KillFact, KillAttacker, and KillVictim records
        const result = await this.prisma.$transaction(async (tx) => {
          // Create the KillFact first
          // If victim is tracked, create a LossFact too
          // If attacker is tracked, create a KillFact

          // Determine which type of record(s) to create
          let killmailCharacterId = BigInt(0);

          if (trackedAttackers.length > 0) {
            // Use the first tracked attacker as the character_id for KillFact
            killmailCharacterId = BigInt(trackedAttackers[0].characterId!);
          } else if (isVictimTracked) {
            // If there are no tracked attackers but the victim is tracked
            killmailCharacterId = BigInt(victim.characterId!);
          }

          const killFact = await tx.killFact.create({
            data: {
              killmail_id: BigInt(killId),
              kill_time: new Date(esiData.killmail_time),
              system_id: esiData.solar_system_id,
              total_value: BigInt(Math.round(killmail.zkb.totalValue)),
              points: killmail.zkb.points,
              character_id: killmailCharacterId,
              npc: false, // Default values
              solo: attackers.length === 1,
              awox: false, // We could calculate this later if needed
              ship_type_id: esiData.victim.ship_type_id,
              labels: [],
            },
          });

          // Create the KillVictim record
          if (victim) {
            await tx.killVictim.create({
              data: {
                killmail_id: BigInt(killId),
                character_id: victim.characterId
                  ? BigInt(victim.characterId)
                  : null,
                corporation_id: victim.corporationId
                  ? BigInt(victim.corporationId)
                  : null,
                alliance_id: victim.allianceId
                  ? BigInt(victim.allianceId)
                  : null,
                ship_type_id: victim.shipTypeId,
                damage_taken: victim.damageTaken,
              },
            });
            logger.info(`Created KillVictim record for killmail ${killId}`);
          }

          // Create the KillAttacker records
          for (const attacker of attackers) {
            await tx.killAttacker.create({
              data: {
                killmail_id: BigInt(killId),
                character_id: attacker.characterId
                  ? BigInt(attacker.characterId)
                  : null,
                corporation_id: attacker.corporationId
                  ? BigInt(attacker.corporationId)
                  : null,
                alliance_id: attacker.allianceId
                  ? BigInt(attacker.allianceId)
                  : null,
                damage_done: attacker.damageDone,
                final_blow: attacker.finalBlow,
                security_status: attacker.securityStatus,
                ship_type_id: attacker.shipTypeId,
                weapon_type_id: attacker.weaponTypeId,
              },
            });
          }
          logger.info(
            `Created ${attackers.length} KillAttacker records for killmail ${killId}`
          );

          // If the victim is one of our tracked characters, create a LossFact record
          if (isVictimTracked) {
            await tx.lossFact.upsert({
              where: { killmail_id: BigInt(killId) },
              update: {}, // No need to update if it exists
              create: {
                killmail_id: BigInt(killId),
                character_id: BigInt(victim.characterId!),
                kill_time: new Date(esiData.killmail_time),
                ship_type_id: victim.shipTypeId,
                system_id: esiData.solar_system_id,
                total_value: BigInt(Math.round(killmail.zkb.totalValue)),
                attacker_count: attackers.length,
                labels: killmail.zkb.labels || [],
              },
            });
            logger.info(
              `Created LossFact record for tracked victim in killmail ${killId}`
            );
          }

          return killFact;
        });

        killFact = result;
      } catch (err) {
        logger.error(
          `Failed to create kill records for killmail ${killId}: ${err}`
        );
        logger.info("Skipping further processing for this killmail");
        return {
          success: false,
          skipped: true,
        };
      }

      // Log which tracked characters were involved
      let relationshipCount = 0;
      for (const relation of characterRelations) {
        if (trackedCharacterMap.has(relation.characterId)) {
          try {
            // Log tracked character involvement
            logger.info(
              `Tracked character ${relation.characterId} involved in killmail ${killId} as ${relation.role}`
            );
            relationshipCount++;
          } catch (err) {
            logger.warn(`Failed to log character relationship: ${err}`);
          }
        }
      }

      logger.info(
        `Ingested killmail ${killId} with ${relationshipCount} tracked character relationships`
      );

      return {
        success: true,
        timestamp: esiData.killmail_time,
        age: Math.floor(
          (Date.now() - new Date(esiData.killmail_time).getTime()) /
            (1000 * 60 * 60 * 24)
        ),
      };
    } catch (error) {
      logger.error(
        {
          error,
          killId,
          errorMessage: error instanceof Error ? error.message : error,
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        "Failed to ingest killmail"
      );
      return {
        success: false,
        skipped: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async ingestMapActivity(slug: string, days: number = 7): Promise<void> {
    const cacheKey = `map:${slug}:${days}`;

    try {
      logger.info(
        `Starting map activity ingestion for map ${slug} over ${days} days`
      );

      logger.debug(`Fetching map activity data from API for slug: ${slug}`);
      const response = await this.cache.getOrSet(cacheKey, () =>
        this.map.getCharacterActivity(slug, days)
      );

      if (!response || !response.data) {
        logger.warn(`No map activity data received for slug: ${slug}`);
        return;
      }

      logger.info(
        `Received ${response.data.length} map activity records from API`
      );
      logger.debug(
        `First few records: ${JSON.stringify(response.data.slice(0, 2))}`
      );

      let successCount = 0;
      let errorCount = 0;

      for (const activity of response.data) {
        try {
          if (!activity.character || !activity.character.eve_id) {
            logger.warn(
              `Skipping map activity with missing character info: ${JSON.stringify(
                activity
              )}`
            );
            continue;
          }

          const mapActivity = {
            characterId: String(activity.character.eve_id),
            timestamp: new Date(activity.timestamp),
            signatures: activity.signatures,
            connections: activity.connections,
            passages: activity.passages,
            allianceId: activity.character.alliance_id,
            corporationId: activity.character.corporation_id,
          };

          logger.debug(
            `Processing map activity for character ${mapActivity.characterId} at ${mapActivity.timestamp}`
          );

          await (this.prisma as any).mapActivity.upsert({
            where: {
              characterId_timestamp: {
                characterId: mapActivity.characterId,
                timestamp: mapActivity.timestamp,
              },
            },
            update: mapActivity,
            create: mapActivity,
          });

          successCount++;
        } catch (activityError) {
          errorCount++;
          logger.error(
            {
              error: activityError,
              activityData: activity,
            },
            `Failed to process individual map activity record`
          );
        }
      }

      logger.info(
        `Map activity ingestion complete. Successfully processed ${successCount} records with ${errorCount} errors.`
      );

      // Log count of records in database after ingestion
      const dbCount = await this.prisma.mapActivity.count();
      logger.info(
        `Total map activity records in database after ingestion: ${dbCount}`
      );
    } catch (error) {
      logger.error({ error, slug, days }, "Failed to ingest map activity");
      throw error;
    }
  }

  async syncUserCharacters(slug: string): Promise<void> {
    const cacheKey = `characters:${slug}`;

    try {
      logger.info(`Starting character sync for slug: ${slug}`);
      const response = await this.cache.getOrSet(cacheKey, () =>
        this.map.getUserCharacters(slug)
      );

      logger.info(`Processing ${response.data.length} user entries`);
      let totalCharacters = 0;
      let skippedCharacters = 0;

      // Process each user's characters
      for (const user of response.data) {
        const mainCharacterId = user.main_character_eve_id;
        logger.info(
          `Processing user with main character: ${mainCharacterId || "none"}`
        );
        logger.info(`User has ${user.characters.length} characters`);

        // Log the main character name if it exists
        const mainChar = user.characters.find(
          (char) => char.eve_id === mainCharacterId
        );
        if (mainChar) {
          logger.info(
            `Main character from API: ${mainChar.name} (${mainCharacterId})`
          );
        }

        // Skip if there are no characters
        if (user.characters.length === 0) {
          logger.warn(`Skipping user with no characters`);
          continue;
        }

        // Get character IDs from this user
        const userCharacterIds = user.characters.map((char) => char.eve_id);

        // First, check if any of these characters already belong to a group
        const existingCharacters = await this.prisma.character.findMany({
          where: {
            eveId: {
              in: userCharacterIds,
            },
            characterGroupId: {
              not: null,
            },
          },
          include: {
            characterGroup: true,
          },
        });

        let characterGroup;

        // If some characters already belong to a group, use that group instead of creating a new one
        if (existingCharacters.length > 0) {
          // Use the first character's group as the target group for all characters
          characterGroup = existingCharacters[0].characterGroup;
          if (characterGroup) {
            logger.info(
              `Found existing group ${characterGroup.id} (${characterGroup.slug}) for ${existingCharacters.length} characters`
            );

            // Log the current main character of the group
            if (characterGroup.mainCharacterId) {
              const currentMainChar = await this.prisma.character.findUnique({
                where: { eveId: characterGroup.mainCharacterId },
              });
              logger.info(
                `Current main character in group: ${
                  currentMainChar?.name || "Unknown"
                } (${characterGroup.mainCharacterId})`
              );
            }
          } else {
            logger.warn(
              `Unexpected null character group for existing character`
            );
          }
        } else {
          // Create a unique group ID for this user
          const groupId = `${slug}_${mainCharacterId || uuidv4()}`;

          // Create or update character group for this user in a safe manner
          // This ensures we never create empty groups
          characterGroup = await this.prisma.$transaction(async (tx) => {
            // Check if group already exists
            const existingGroup = await tx.characterGroup.findUnique({
              where: { slug: groupId },
              include: { characters: true },
            });

            if (existingGroup) {
              // If updating, just return the existing group
              return existingGroup;
            }

            // If creating new, ensure we have characters
            if (userCharacterIds.length === 0) {
              logger.warn(`Cannot create group ${groupId} without characters`);
              return null;
            }

            // Create new group
            return await tx.characterGroup.create({
              data: {
                slug: groupId,
                mainCharacterId: mainCharacterId || null,
              },
            });
          });
        }

        // Skip processing if group creation failed
        if (!characterGroup) {
          logger.warn(
            `Skipping user with main character ${
              mainCharacterId || "none"
            } - could not create/find group`
          );
          continue;
        }

        logger.info(
          `Using character group: ${characterGroup.id} (${characterGroup.slug}) for user with ${user.characters.length} characters`
        );

        // First, clear main character status for all characters in this group
        // This ensures we start fresh with the API data
        await this.prisma.character.updateMany({
          where: { characterGroupId: characterGroup.id },
          data: { isMain: false },
        });

        // Process each character
        for (const char of user.characters) {
          totalCharacters++;
          const character: Character = {
            eveId: char.eve_id,
            name: char.name,
            allianceId: char.alliance_id,
            allianceTicker: char.alliance_ticker,
            corporationId: char.corporation_id,
            corporationTicker: char.corporation_ticker,
            isMain: mainCharacterId ? char.eve_id === mainCharacterId : false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          try {
            // First check if this character already belongs to a different group
            const existingChar = await this.prisma.character.findUnique({
              where: { eveId: character.eveId },
              include: { characterGroup: true },
            });

            if (
              existingChar &&
              existingChar.characterGroupId &&
              existingChar.characterGroupId !== characterGroup.id
            ) {
              logger.info(
                `Character ${character.name} (${character.eveId}) already belongs to group ${existingChar.characterGroupId}. Moving to group ${characterGroup.id}.`
              );
            }

            // Create or update character
            const updatedCharacter = await this.prisma.character.upsert({
              where: { eveId: character.eveId },
              update: {
                name: character.name,
                allianceId: character.allianceId,
                allianceTicker: character.allianceTicker,
                corporationId: character.corporationId,
                corporationTicker: character.corporationTicker,
                isMain: character.isMain,
                characterGroupId: characterGroup.id,
                mainCharacterId: character.isMain ? null : mainCharacterId, // Only set mainCharacterId if this is not the main character
              },
              create: {
                ...character,
                characterGroupId: characterGroup.id,
                mainCharacterId: character.isMain ? null : mainCharacterId, // Only set mainCharacterId if this is not the main character
              },
            });

            logger.info(
              `Processed character: ${character.name} (${character.eveId}) - isMain: ${character.isMain}`
            );

            // If this is the main character, update the group's main character reference
            if (updatedCharacter.isMain && mainCharacterId) {
              await this.prisma.characterGroup.update({
                where: { id: characterGroup.id },
                data: {
                  mainCharacterId: updatedCharacter.eveId,
                },
              });

              // Update all characters in this group to reference the main character
              await this.prisma.character.updateMany({
                where: {
                  characterGroupId: characterGroup.id,
                  eveId: { not: updatedCharacter.eveId }, // Don't update the main character itself
                },
                data: {
                  mainCharacterId: updatedCharacter.eveId,
                },
              });

              logger.info(
                `Set main character for group: ${updatedCharacter.name} (${updatedCharacter.eveId})`
              );
            }
          } catch (error) {
            skippedCharacters++;
            logger.error(
              { error, character },
              `Failed to process character: ${character.name} (${character.eveId})`
            );
          }
        }

        // After processing all characters, verify the group's main character
        const updatedGroup = await this.prisma.characterGroup.findUnique({
          where: { id: characterGroup.id },
          include: {
            characters: true,
          },
        });

        if (updatedGroup) {
          logger.info(`Group ${updatedGroup.slug} final state:`);
          logger.info(`Main character ID: ${updatedGroup.mainCharacterId}`);

          const mainChar = updatedGroup.characters.find(
            (c) => c.eveId === updatedGroup.mainCharacterId
          );
          if (mainChar) {
            logger.info(`Main character name: ${mainChar.name}`);
          }

          // Log all characters in the group and their main character references
          logger.info("Characters in group:");
          for (const char of updatedGroup.characters) {
            const mainCharRef = char.mainCharacterId
              ? updatedGroup.characters.find(
                  (c) => c.eveId === char.mainCharacterId
                )?.name
              : "none";
            logger.info(
              `- ${char.name} (${char.eveId}) - isMain: ${char.isMain} - mainCharacterRef: ${mainCharRef}`
            );
          }
        }
      }

      logger.info(
        `Character sync complete. Total: ${totalCharacters}, Skipped: ${skippedCharacters}`
      );
    } catch (error) {
      logger.error({ error, slug }, "Failed to sync user characters");
      throw error;
    }
  }

  async backfillKills(
    characterId: number,
    maxAgeInDays: number = 30
  ): Promise<void> {
    let page = 1;
    let hasMore = true;
    let lastSeenId: bigint | null = null;

    try {
      // Check if we've backfilled recently (within the last hour)
      const character = await this.prisma.character.findUnique({
        where: { eveId: String(characterId) },
      });

      if (!character) {
        logger.warn(`Character ${characterId} not found in database`);
        return;
      }

      if (character.lastBackfillAt) {
        const hoursSinceLastBackfill =
          (Date.now() - character.lastBackfillAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastBackfill < 1) {
          logger.info(
            `Skipping backfill for character ${characterId} - last backfill was ${hoursSinceLastBackfill.toFixed(
              2
            )} hours ago`
          );
          return;
        }
      }

      // Calculate the cutoff date for maxAgeInDays
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);
      logger.info(
        `Only retrieving kills newer than ${cutoffDate.toISOString()} for character ${characterId}`
      );

      // Get the last seen ID from checkpoint
      const checkpoint = await this.prisma.ingestionCheckpoint.findUnique({
        where: { streamName: `kills:${characterId}` },
      });

      if (checkpoint) {
        lastSeenId = checkpoint.lastSeenId;
        logger.info(
          { characterId, lastSeenId: checkpoint.lastSeenId.toString() },
          "Found existing checkpoint"
        );
      }

      while (hasMore) {
        try {
          logger.debug({ characterId, page }, "Fetching page of kills");
          const kills = await this.zkill.getCharacterKills(characterId, page);

          if (kills.length === 0) {
            logger.info({ characterId, page }, "No more kills found");
            hasMore = false;
            continue;
          }

          logger.info(
            { characterId, page, killCount: kills.length },
            "Processing page of kills"
          );

          let foundLastSeen = false;
          let foundOldKill = false;

          for (const kill of kills) {
            try {
              // Parse kill ID
              const killId = kill.killmail_id;

              // Check if killId is undefined and skip this kill if it is
              if (killId === undefined) {
                logger.error(
                  { killId, kill },
                  "Kill missing killmail_id, skipping"
                );
                continue;
              }

              const killIdBigInt = BigInt(killId);

              // If we've seen this kill before, we can stop
              if (lastSeenId && killIdBigInt <= lastSeenId) {
                foundLastSeen = true;
                logger.info(
                  { characterId, lastSeenId: lastSeenId.toString() },
                  "Found previously processed kill, stopping"
                );
                break;
              }

              // Fetch killmail details to get the timestamp
              const killDetails = await this.zkill.getKillmail(killId);

              // Get ESI data to check kill date
              const esiData = await this.fetchEsiData(
                killId,
                killDetails.zkb.hash
              );

              // Check if this kill is too old
              if (esiData && esiData.killmail_time) {
                const killDate = new Date(esiData.killmail_time);
                if (killDate < cutoffDate) {
                  logger.info(
                    `Found kill ${killId} from ${killDate.toISOString()} - older than ${maxAgeInDays} days, stopping backfill for this character`
                  );
                  foundOldKill = true;
                  break;
                }
              }

              // Ingest the killmail which will fetch detailed ESI data
              const result = await this.ingestKillmail(killId);

              // Update checkpoint after each successful ingestion
              await this.prisma.ingestionCheckpoint.upsert({
                where: { streamName: `kills:${characterId}` },
                update: {
                  lastSeenId: killIdBigInt,
                  lastSeenTime: new Date(),
                },
                create: {
                  streamName: `kills:${characterId}`,
                  lastSeenId: killIdBigInt,
                  lastSeenTime: new Date(),
                },
              });
            } catch (error: any) {
              logger.error(
                {
                  error,
                  killId: kill.killmail_id,
                  errorMessage: error?.message,
                  errorStack: error?.stack,
                },
                "Failed to process individual kill"
              );
              continue; // Skip this kill and continue with the next one
            }
          }

          // If we found the last seen ID or an old kill, stop processing this character
          if (foundLastSeen || foundOldKill) {
            logger.info(
              {
                characterId,
                reason: foundLastSeen
                  ? "Found last seen kill"
                  : "Found old kill",
              },
              "Stopping backfill for this character"
            );
            hasMore = false;
            continue;
          }

          page++;
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.backoffMs)
          );
        } catch (error: any) {
          logger.error(
            {
              error,
              characterId,
              page,
              errorMessage: error?.message,
              errorStack: error?.stack,
            },
            "Failed to process page of kills"
          );
          hasMore = false;
        }
      }

      // Update lastBackfillAt after successful backfill
      await this.prisma.character.update({
        where: { eveId: String(characterId) },
        data: { lastBackfillAt: new Date() },
      });

      logger.info(`Completed backfill for character ${characterId}`);
    } catch (error: any) {
      logger.error(
        {
          error,
          characterId,
          errorMessage: error?.message,
          errorStack: error?.stack,
        },
        "Failed to backfill kills for character"
      );
      throw error;
    }
  }

  /**
   * Backfill losses for a character from zKillboard API
   */
  async backfillLosses(
    characterId: number,
    maxAgeDays: number = 30
  ): Promise<void> {
    try {
      logger.info(
        `Backfilling losses for character ID ${characterId} from zKillboard`
      );

      // Build the URL
      const url = `${process.env.ZKILLBOARD_API_URL}/losses/characterID/${characterId}/`;
      logger.debug(`Fetching losses from URL: ${url}`);

      const response = await axios.get(url, {
        headers: {
          "User-Agent": "EVE-Chart-Bot/1.0",
          Accept: "application/json",
        },
      });

      if (!response.data || !Array.isArray(response.data)) {
        logger.warn(
          `Invalid response from zKillboard for character ${characterId} losses`
        );
        return;
      }

      logger.info(
        `Received ${response.data.length} losses from zKillboard for character ${characterId}`
      );

      // Process each loss
      let processedCount = 0;
      let skippedCount = 0;

      for (const loss of response.data) {
        try {
          const killmailId = loss.killmail_id;

          // Check if we already have this loss
          const existingLoss = await this.prisma.lossFact.findUnique({
            where: { killmail_id: BigInt(killmailId) },
          });

          if (existingLoss) {
            logger.debug(
              `Loss ${killmailId} already exists in database, skipping`
            );
            skippedCount++;
            continue;
          }

          // Check the age of the loss if timestamp is available
          if (loss.killmail_time) {
            const killTime = new Date(loss.killmail_time);
            const ageInDays = Math.floor(
              (Date.now() - killTime.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (ageInDays > maxAgeDays) {
              logger.debug(
                `Skipping loss ${killmailId} - age ${ageInDays} days exceeds max age ${maxAgeDays} days`
              );
              skippedCount++;
              continue;
            }
          }

          // Create the loss record
          await this.prisma.lossFact.create({
            data: {
              killmail_id: BigInt(killmailId),
              character_id: BigInt(characterId),
              kill_time: new Date(loss.killmail_time || new Date()),
              ship_type_id: loss.victim?.ship_type_id || 0,
              system_id: loss.solar_system_id || 0,
              total_value: BigInt(Math.round(loss.zkb?.totalValue || 1000000)),
              attacker_count: loss.attackers?.length || 1,
              labels: loss.zkb?.labels || [],
            },
          });

          processedCount++;
          logger.debug(
            `Successfully processed loss ${killmailId} for character ${characterId}`
          );
        } catch (error) {
          logger.error(`Error processing loss: ${error}`);
        }
      }

      logger.info(
        `Finished backfilling losses for character ${characterId}: processed ${processedCount}, skipped ${skippedCount}`
      );
    } catch (error) {
      logger.error(
        `Error backfilling losses for character ${characterId}: ${error}`
      );
    }
  }

  async close(): Promise<void> {
    await this.cache.close();
    await this.prisma.$disconnect();
  }

  private async fetchEsiData(killmailId: number, hash: string): Promise<any> {
    try {
      const response = await fetch(
        `https://esi.evetech.net/latest/killmails/${killmailId}/${hash}/`,
        {
          headers: {
            "User-Agent": "EVE Chart Bot - Contact: admin@example.com",
          },
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch ESI data: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      logger.error("Error fetching ESI data:", error);
      return null;
    }
  }

  private async updateCheckpoint(
    killId: string | number,
    killmailId: string | number
  ) {
    await this.prisma.ingestionCheckpoint.upsert({
      where: { streamName: "kills" },
      update: {
        lastSeenId: BigInt(killmailId),
        lastSeenTime: new Date(),
      },
      create: {
        streamName: "kills",
        lastSeenId: BigInt(killmailId),
        lastSeenTime: new Date(),
      },
    });
  }
}
