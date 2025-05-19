import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger";
import axios from "axios";
import { IngestionService } from "../services/IngestionService";
import { fetchESIKillmail } from "../lib/esi";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL environment variable is required");
}

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);

interface RedisQKillmail {
  killID: number;
  hash: string;
  package: {
    killID: number;
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
    zkb?: {
      locationID: number;
      hash: string;
      fittedValue: number;
      droppedValue: number;
      destroyedValue: number;
      totalValue: number;
      points: number;
      npc: boolean;
      solo: boolean;
      awox: boolean;
    };
  };
}

// Keep track of which characters we're interested in
const trackedCharacterIds = new Set<string>();

// Refresh tracked characters from the database
export async function refreshTrackedCharacters() {
  try {
    logger.info("Refreshing tracked characters list...");

    const characters = await prisma.character.findMany();
    const oldTrackedCount = trackedCharacterIds.size;

    // Clear existing set
    trackedCharacterIds.clear();

    // Add all character IDs to the set
    for (const character of characters) {
      trackedCharacterIds.add(character.eveId);
    }

    logger.info(
      `Tracked characters refreshed: ${oldTrackedCount} → ${trackedCharacterIds.size}`
    );

    if (trackedCharacterIds.size > 0) {
      const sampleCharacters = Array.from(trackedCharacterIds).slice(0, 5);
      logger.debug(
        `Sample tracked character IDs: ${sampleCharacters.join(", ")}`
      );
    } else {
      logger.warn("No tracked characters found in database!");
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Error refreshing tracked characters"
    );
  }
}

// Function to check if a killmail has a tracked character as attacker or victim
function isRelevantKillmail(killmail: RedisQKillmail): boolean {
  // Check if victim is a tracked character
  if (
    killmail.package.victim?.character_id &&
    trackedCharacterIds.has(String(killmail.package.victim.character_id))
  ) {
    logger.debug(
      `Killmail ${killmail.killID} has a tracked victim: ${killmail.package.victim.character_id}`
    );
    return true;
  }

  // Ensure attackers array exists
  if (
    !killmail.package.attackers ||
    !Array.isArray(killmail.package.attackers)
  ) {
    logger.debug(`Killmail ${killmail.killID} has no valid attackers array`);
    return false;
  }

  // Check if any attacker is a tracked character
  for (const attacker of killmail.package.attackers) {
    if (
      attacker?.character_id &&
      trackedCharacterIds.has(String(attacker.character_id))
    ) {
      logger.debug(
        `Killmail ${killmail.killID} has a tracked attacker: ${attacker.character_id}`
      );
      return true;
    }
  }

  return false;
}

// Function to check if a killmail represents a tracked character's loss
function isTrackedCharacterLoss(killmail: RedisQKillmail): boolean {
  if (!killmail.package?.victim || !killmail.package.victim.character_id) {
    logger.debug(
      `Killmail ${killmail.killID} has no victim character_id, not a player loss`
    );
    return false;
  }

  const victimId = String(killmail.package.victim.character_id);
  const isTracked = trackedCharacterIds.has(victimId);

  logger.debug(
    `Checking if victim ${victimId} is tracked: ${isTracked ? "YES" : "NO"}`
  );
  if (isTracked) {
    logger.info(
      `Found loss for tracked character: ${victimId} in killmail ${killmail.killID}`
    );
  }

  return isTracked;
}

/**
 * Helper function to safely serialize objects containing BigInt values
 */
function serializeBigInt(data: any): any {
  return JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

async function processKillmail(killmail: RedisQKillmail) {
  try {
    // Check if the killmail has all the data we need for relevance check
    const hasVictimCharacterId = Boolean(
      killmail.package?.victim?.character_id
    );
    const hasAttackers = Boolean(
      killmail.package?.attackers && killmail.package.attackers.length > 0
    );
    const attackersWithCharacterId =
      killmail.package?.attackers?.filter((a: any) => Boolean(a.character_id))
        ?.length || 0;

    // Log minimal data completeness info
    logger.debug(
      {
        killmailId: killmail.killID,
        hasData: hasVictimCharacterId && attackersWithCharacterId > 0,
      },
      `Data check for killmail ${killmail.killID}`
    );

    // Skip if no tracked characters are involved - first try with the data we have
    // This avoids unnecessary ESI calls for obviously irrelevant killmails
    if (!isRelevantKillmail(killmail)) {
      logger.debug(
        `Skipping irrelevant killmail ${killmail.killID} - initial check with RedisQ data`
      );
      return;
    }

    // We only need to fetch ESI data for processing the killmail, not for relevance check
    // Only fetch if we're missing critical data for processing
    let completeKillmail = killmail;
    const needsEsiData = !hasVictimCharacterId || !hasAttackers;

    if (needsEsiData) {
      logger.debug(
        `Fetching ESI data for incomplete killmail ${killmail.killID} for processing`
      );
      try {
        const esiData = await fetchESIKillmail(killmail.killID, killmail.hash);

        // Merge ESI data with the RedisQ data for a complete killmail
        completeKillmail = {
          ...killmail,
          package: {
            ...killmail.package,
            victim: {
              ...killmail.package.victim,
              ...esiData.victim,
            },
            attackers: esiData.attackers,
          },
        };
        logger.debug(
          `Successfully merged ESI data for killmail ${killmail.killID}`
        );
      } catch (esiError) {
        logger.warn(
          {
            error:
              esiError instanceof Error ? esiError.message : String(esiError),
            stack: esiError instanceof Error ? esiError.stack : undefined,
            killmailId: killmail.killID,
          },
          `Failed to fetch ESI data for killmail ${killmail.killID}, proceeding with RedisQ data only`
        );
      }
    } else {
      logger.debug(
        `Killmail ${killmail.killID} already has sufficient data, skipping ESI fetch`
      );
    }

    // Process as a kill
    await processAsKill(completeKillmail);

    // Check if the victim is a tracked character
    const isLoss = isTrackedCharacterLoss(completeKillmail);
    logger.debug(
      `Killmail ${killmail.killID} isTrackedCharacterLoss: ${isLoss}`
    );

    // If the victim is a tracked character, also process as a loss
    if (isLoss) {
      logger.info(`Processing killmail ${killmail.killID} as a loss`);
      await processAsLoss(completeKillmail);
    }
  } catch (error) {
    logger.error(
      {
        killmailId: killmail.killID,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      `Error processing killmail ${killmail.killID}`
    );
  }
}

async function processAsKill(killmail: RedisQKillmail) {
  try {
    // Check if we've already processed this killmail
    const existing = await (prisma as any).killFact.findUnique({
      where: { killmail_id: BigInt(killmail.killID) },
    });

    if (existing) {
      logger.debug(`Killmail ${killmail.killID} already processed as kill`);
      return;
    }

    // 1. Check if we need ESI data for database operations
    // The main need is for victim/attacker details that might be missing
    let needsEsiData = false;

    // Check if we have all the required data
    if (
      !killmail.package.victim?.character_id &&
      !killmail.package.victim?.ship_type_id
    ) {
      needsEsiData = true;
    }

    if (
      !killmail.package.attackers ||
      killmail.package.attackers.length === 0
    ) {
      needsEsiData = true;
    }

    // Only fetch ESI data if we really need it
    if (needsEsiData) {
      logger.debug(
        `Fetching ESI data for database operations for killmail ${killmail.killID}`
      );
      const esiData = await fetchESIKillmail(killmail.killID, killmail.hash);

      // Update the killmail with ESI data
      killmail = {
        ...killmail,
        package: {
          ...killmail.package,
          victim: {
            ...killmail.package.victim,
            ...esiData.victim,
          },
          attackers: esiData.attackers,
        },
      };

      logger.debug(
        `Updated killmail ${killmail.killID} with ESI data for database operations`
      );
    } else {
      logger.debug(
        `Using existing killmail data for ${killmail.killID}, ESI fetch not needed for database operations`
      );
    }

    // 2. Process victim data
    const victim = {
      characterId: killmail.package.victim.character_id,
      corporationId: killmail.package.victim.corporation_id,
      allianceId: killmail.package.victim.alliance_id,
      shipTypeId: killmail.package.victim.ship_type_id,
      damageTaken: killmail.package.victim.damage_taken,
    };
    logger.debug("Processed victim data", { victim });

    // 3. Process attackers
    const attackers = killmail.package.attackers.map((attacker) => ({
      characterId: attacker.character_id,
      corporationId: attacker.corporation_id,
      allianceId: attacker.alliance_id,
      damageDone: attacker.damage_done,
      finalBlow: attacker.final_blow,
      securityStatus: attacker.security_status,
      shipTypeId: attacker.ship_type_id,
      weaponTypeId: attacker.weapon_type_id,
    }));
    logger.debug("Processed attacker data", { attackers });

    // 4. Create character relationships
    const characterRelations = [
      // Add victim if it's a player
      ...(victim.characterId
        ? [
            {
              characterId: String(victim.characterId), // Convert to string to match Character.eveId
              role: "victim",
            },
          ]
        : []),
      // Add all attackers
      ...attackers
        .filter((a) => a.characterId) // Only include player attackers
        .map((a) => ({
          characterId: String(a.characterId!), // Convert to string to match Character.eveId
          role: "attacker",
        })),
    ];
    logger.debug("Created character relations", { characterRelations });

    // Log all characters in database
    const dbCharacters = await prisma.character.findMany();
    logger.debug("Characters in database", { dbCharacters });

    // 5. Calculate total value from items
    const totalValue = killmail.package.victim.items.reduce((sum, item) => {
      const quantity =
        (item.quantity_destroyed || 0) + (item.quantity_dropped || 0);
      return sum + quantity * (item.singleton ? 1 : 0); // TODO: Add item value lookup
    }, 0);
    logger.debug("Calculated total value", { totalValue });

    // 6. Create KillFact with relationships
    try {
      await prisma.$transaction(async (tx) => {
        try {
          // Determine if it's a solo kill - single player attacker
          const playerAttackers = killmail.package.attackers.filter(
            (a) => a.character_id
          );
          const isSolo = playerAttackers.length === 1;

          // Use upsert instead of create to handle duplicates
          const kill = await (tx as any).killFact.upsert({
            where: {
              killmail_id: BigInt(killmail.killID),
            },
            update: {
              kill_time: new Date(killmail.package.killmail_time),
              system_id: killmail.package.solar_system_id,
              total_value: BigInt(totalValue),
              points: killmail.package.zkb?.points || 0,
              character_id: BigInt(killmail.package.victim.character_id || 0),
              npc: false,
              solo: isSolo, // Set solo flag based on player attacker count
              awox: false,
              ship_type_id: killmail.package.victim.ship_type_id,
              labels: [],
            },
            create: {
              killmail_id: BigInt(killmail.killID),
              kill_time: new Date(killmail.package.killmail_time),
              system_id: killmail.package.solar_system_id,
              total_value: BigInt(totalValue),
              points: killmail.package.zkb?.points || 0,
              character_id: BigInt(killmail.package.victim.character_id || 0),
              npc: false,
              solo: isSolo, // Set solo flag based on player attacker count
              awox: false,
              ship_type_id: killmail.package.victim.ship_type_id,
              labels: [],
            },
          });
          logger.debug("Created/Updated kill fact", { kill });

          // Delete existing attackers and victims before creating new ones
          await (tx as any).killAttacker.deleteMany({
            where: { killmail_id: BigInt(killmail.killID) },
          });
          await (tx as any).killVictim.deleteMany({
            where: { killmail_id: BigInt(killmail.killID) },
          });

          // Create victim
          if (victim.characterId) {
            await (tx as any).killVictim.create({
              data: {
                killmail_id: kill.killmail_id,
                character_id: BigInt(victim.characterId),
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
            logger.debug("Created victim");
          }

          // Create attackers
          for (const attacker of attackers) {
            await (tx as any).killAttacker.create({
              data: {
                killmail_id: kill.killmail_id,
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
          logger.debug("Created attackers");

          // Note: KillCharacter relations are no longer needed

          // Update checkpoint
          await tx.ingestionCheckpoint.upsert({
            where: { streamName: "killmails" },
            update: {
              lastSeenId: BigInt(killmail.killID),
              lastSeenTime: new Date(killmail.package.killmail_time),
            },
            create: {
              streamName: "killmails",
              lastSeenId: BigInt(killmail.killID),
              lastSeenTime: new Date(killmail.package.killmail_time),
            },
          });
          logger.debug("Updated checkpoint");

          logger.info("Processed killmail", {
            killmailId: killmail.killID,
            victimId: victim.characterId,
            attackerCount: attackers.length,
            characterCount: characterRelations.length,
          });
        } catch (error) {
          logger.error(
            {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              operation: error instanceof Error ? error.name : undefined,
            },
            "Error in transaction operation"
          );
          throw error;
        }
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          killmailId: killmail.killID,
        },
        "Error in database transaction"
      );
      throw error;
    }
  } catch (error) {
    logger.error(
      {
        killmailId: killmail.killID,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      `Error processing killmail ${killmail.killID} as kill`
    );
  }
}

async function processAsLoss(killmail: RedisQKillmail) {
  try {
    // Check if we've already processed this loss
    const existing = await prisma.lossFact.findUnique({
      where: { killmail_id: BigInt(killmail.killID) },
    });

    if (existing) {
      logger.debug(`Killmail ${killmail.killID} already processed as loss`);
      return;
    }

    // Get victim character ID
    if (!killmail.package?.victim?.character_id) {
      logger.warn(
        {
          killmailId: killmail.killID,
        },
        `Cannot process loss: missing victim character_id in killmail ${killmail.killID}`
      );
      return;
    }

    const characterId = BigInt(killmail.package.victim.character_id);
    logger.debug(
      `Processing loss for character ID ${characterId} from killmail ${killmail.killID}`
    );

    // Calculate total value (this would typically come from zKillboard API)
    // For simplicity, we're using a placeholder calculation here
    const totalValue =
      killmail.package.victim.items?.reduce((sum, item) => {
        const quantity =
          (item.quantity_destroyed || 0) + (item.quantity_dropped || 0) || 1;
        // Placeholder value calculation - in production you would use market prices
        const itemValue = item.type_id * 10000; // Simple placeholder
        return sum + quantity * itemValue;
      }, 1000000) || 1000000; // Base value of 1M ISK

    logger.debug(
      `Calculated total loss value: ${totalValue} for killmail ${killmail.killID}`
    );

    // Store the loss in the database
    try {
      const result = await prisma.lossFact.create({
        data: {
          killmail_id: BigInt(killmail.killID),
          character_id: characterId,
          kill_time: new Date(killmail.package.killmail_time),
          ship_type_id: killmail.package.victim.ship_type_id,
          system_id: killmail.package.solar_system_id,
          total_value: BigInt(totalValue),
          attacker_count: killmail.package.attackers.length,
          labels: [],
        },
      });
      logger.info(
        `Successfully saved loss to database for killmail ${killmail.killID}`
      );
      logger.debug(`Loss record created: ${serializeBigInt(result)}`);
    } catch (dbError) {
      logger.error(
        {
          killmailId: killmail.killID,
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined,
        },
        `Database error saving loss for killmail ${killmail.killID}`
      );
      throw dbError;
    }

    logger.info(
      `Processed killmail ${killmail.killID} as loss for character ${characterId}`
    );
  } catch (error) {
    logger.error(
      {
        killmailId: killmail.killID,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      `Error processing killmail ${killmail.killID} as loss`
    );
  }
}

async function fetchKillmail(killId: number): Promise<RedisQKillmail> {
  const response = await axios.get(
    `https://zkillboard.com/api/killID/${killId}/`
  );
  return response.data as RedisQKillmail;
}

async function backfillMissingKillmails() {
  try {
    const checkpoint = await prisma.ingestionCheckpoint.findUnique({
      where: { streamName: "killmails" },
    });

    if (!checkpoint) {
      logger.info("No checkpoint found, starting fresh");
      return;
    }

    const lastSeenId = checkpoint.lastSeenId;
    logger.info(`Starting backfill from killmail ID ${lastSeenId}`);

    try {
      // Fetch recent killmails from zKillboard
      const response = await axios.get("https://zkillboard.com/api/losses/");
      const recentKillIds = response.data as number[];

      if (!Array.isArray(recentKillIds)) {
        logger.error("Invalid response from zKillboard API:", response.data);
        return;
      }

      logger.info(`Found ${recentKillIds.length} recent killmails to check`);

      // Process killmails in reverse order (oldest first)
      for (const killId of [...recentKillIds].reverse()) {
        if (BigInt(killId) <= lastSeenId) {
          continue; // Skip already processed killmails
        }

        try {
          const killmail = await fetchKillmail(killId);
          await processKillmail(killmail);
        } catch (error) {
          logger.error(
            {
              killmailId: killId,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
            `Error processing killmail ${killId} during backfill`
          );
          // Continue with next killmail
        }

        // Add a small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      logger.info("Backfill completed");
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Error fetching recent killmails"
      );
      // Don't throw here, just log the error and continue
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Error during backfill"
    );
    // Don't throw here, just log the error and continue
  }
}

export async function startIngestion() {
  try {
    // Subscribe to RedisQ
    const subscriber = redis.duplicate();
    await subscriber.subscribe("killmails");

    // Track killmails for batch logging
    const ingestionKillmails: number[] = [];
    let lastIngestionSummaryTime = Date.now();

    subscriber.on("message", async (_channel: string, message: string) => {
      try {
        const killmail = JSON.parse(message) as RedisQKillmail;

        // Add to batch counter for regular killmails
        ingestionKillmails.push(killmail.killID);

        // Check if it's time to log a summary (once per minute)
        const currentTime = Date.now();
        if (currentTime - lastIngestionSummaryTime >= 60000) {
          // 60 seconds in milliseconds
          if (ingestionKillmails.length > 0) {
            logger.info(
              `Ingestion service received ${
                ingestionKillmails.length
              } killmails in the last minute. Latest ID: ${
                ingestionKillmails[ingestionKillmails.length - 1]
              }`
            );
            ingestionKillmails.length = 0; // Reset the batch
          }
          lastIngestionSummaryTime = currentTime;
        }

        // Only log detailed information for killmails that are relevant to our tracked characters
        if (isRelevantKillmail(killmail)) {
          logger.info(
            `Received relevant killmail #${killmail.killID} (${new Date(
              killmail.package.killmail_time
            ).toISOString()}): ` +
              `victim ${
                killmail.package.victim.character_id || "NPC"
              } in ship ${killmail.package.victim.ship_type_id}, ` +
              `system ${killmail.package.solar_system_id}, ${killmail.package.attackers.length} attackers`
          );
        }

        await processKillmail(killmail);
      } catch (error: any) {
        logger.error(
          {
            error: error?.message || "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
            messagePrefix: message.substring(0, 100),
          },
          "Failed to process RedisQ message"
        );
      }
    });

    // Start backfill process
    await backfillMissingKillmails();

    // Schedule periodic backfill
    setInterval(backfillMissingKillmails, 60 * 60 * 1000); // Every hour

    logger.info("Ingestion service started");
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Failed to start ingestion service"
    );
    throw error; // Only throw here if we can't start the service at all
  }
}

export class RedisQConsumer {
  private redis: Redis;
  private ingestionService: IngestionService;
  private isRunning = false;
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.ingestionService = new IngestionService({
      zkillApiUrl: process.env.ZKILLBOARD_API_URL!,
      mapApiUrl: process.env.MAP_API_URL,
      mapApiKey: process.env.MAP_API_KEY,
      esiApiUrl: process.env.ESI_API_URL,
      redisUrl: redisUrl,
      cacheTtl: parseInt(process.env.CACHE_TTL || "300"),
      batchSize: parseInt(process.env.BATCH_SIZE || "100"),
      backoffMs: parseInt(process.env.BACKOFF_MS || "1000"),
      maxRetries: parseInt(process.env.MAX_RETRIES || "3"),
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("RedisQ consumer is already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting RedisQ consumer");

    try {
      // Initial refresh of tracked characters
      await refreshTrackedCharacters();

      // Set up periodic refresh of tracked characters (every 5 minutes)
      this.refreshInterval = setInterval(
        refreshTrackedCharacters,
        5 * 60 * 1000
      );

      // Track killmails for batch logging
      const redisKillmails: number[] = [];
      let lastRedisSummaryTime = Date.now();

      // Subscribe to the killmails channel
      const subscriber = this.redis.duplicate();
      await subscriber.subscribe("killmails");

      subscriber.on("message", async (_channel: string, message: string) => {
        try {
          const killmail = JSON.parse(message) as RedisQKillmail;

          // Add to batch counter for regular killmails
          redisKillmails.push(killmail.killID);

          // Check if it's time to log a summary (once per minute)
          const currentTime = Date.now();
          if (currentTime - lastRedisSummaryTime >= 60000) {
            // 60 seconds in milliseconds
            if (redisKillmails.length > 0) {
              logger.info(
                `Redis subscriber received ${
                  redisKillmails.length
                } killmails in the last minute. Latest ID: ${
                  redisKillmails[redisKillmails.length - 1]
                }`
              );
              redisKillmails.length = 0; // Reset the batch
            }
            lastRedisSummaryTime = currentTime;
          }

          // Only log detailed information for killmails that are relevant to our tracked characters
          if (isRelevantKillmail(killmail)) {
            logger.info(
              `Received relevant killmail #${killmail.killID} (${new Date(
                killmail.package.killmail_time
              ).toISOString()}): ` +
                `victim ${
                  killmail.package.victim.character_id || "NPC"
                } in ship ${killmail.package.victim.ship_type_id}, ` +
                `system ${killmail.package.solar_system_id}, ${killmail.package.attackers.length} attackers`
            );
          }

          await processKillmail(killmail);
        } catch (error: any) {
          logger.error(
            {
              error: error?.message || "Unknown error",
              stack: error instanceof Error ? error.stack : undefined,
              messagePrefix: message.substring(0, 100),
            },
            "Failed to process RedisQ message"
          );
        }
      });

      subscriber.on("error", (error: any) => {
        logger.error(
          {
            error: error?.message || "Unknown error",
            stack: error?.stack,
            source: "RedisQ subscriber",
          },
          "RedisQ subscriber error"
        );
      });

      logger.info("RedisQ consumer started successfully");
    } catch (error) {
      this.isRunning = false;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Failed to start RedisQ consumer"
      );
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn("RedisQ consumer is not running");
      return;
    }

    this.isRunning = false;
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    await this.redis.quit();
    await this.ingestionService.close();
    logger.info("RedisQ consumer stopped");
  }
}

// Function to start the RedisQ consumer with an existing IngestionService
export async function startConsumer(
  ingestionService: IngestionService
): Promise<void> {
  logger.info("Starting RedisQ consumer...");

  // First refresh the tracked characters list
  await refreshTrackedCharacters();

  // Start polling RedisQ
  pollRedisQ(ingestionService);

  // Set up interval to refresh tracked characters
  setInterval(refreshTrackedCharacters, 60 * 60 * 1000); // Refresh every hour

  logger.info("RedisQ consumer started successfully");
}

// Poll RedisQ for new killmails
// Track killmails received for summary logging
let killmailsReceived: number[] = [];
let lastSummaryTime = Date.now();

async function pollRedisQ(ingestionService: IngestionService) {
  try {
    logger.debug("Polling RedisQ for new killmails...");
    const url =
      "https://redisq.zkillboard.com/listen.php?queueID=eve-chart-bot";

    const response = await axios.get(url, {
      timeout: 30000, // 30-second timeout
    });

    // Log the raw response structure for debugging
    logger.debug(
      `RedisQ response type: ${typeof response.data}, has package: ${Boolean(
        response.data?.package
      )}, has killID: ${Boolean(response.data?.package?.killID)}`
    );

    if (!response.data) {
      logger.debug("Empty response from RedisQ");
      setTimeout(() => pollRedisQ(ingestionService), 1000);
      return;
    }

    // Check if we have a package but no actual killmail (common with RedisQ when no new killmails)
    if (response.data.package === null) {
      logger.debug("RedisQ returned empty package (no new killmails)");
      setTimeout(() => pollRedisQ(ingestionService), 1000);
      return;
    }

    // Check if we have actual killmail data
    if (response.data.package) {
      // Extract the full RedisQ response which contains killmail data
      const redisQResponse = response.data;

      // Now check if we have a properly structured killmail with an ID
      if (!redisQResponse.package.killID) {
        logger.warn(
          `Received killmail with no ID: ${serializeBigInt(
            redisQResponse
          ).substring(0, 200)}...`
        );
        setTimeout(() => pollRedisQ(ingestionService), 1000);
        return;
      }

      // Add to our batch without logging each one individually
      const killmailId = redisQResponse.package.killID;
      killmailsReceived.push(killmailId);

      // Check if it's time to log a summary (once per minute)
      const currentTime = Date.now();
      if (currentTime - lastSummaryTime >= 60000) {
        // 60 seconds in milliseconds
        // Log a summary of killmails received
        if (killmailsReceived.length > 0) {
          logger.info(
            `Received ${
              killmailsReceived.length
            } killmails in the last minute. Latest ID: ${
              killmailsReceived[killmailsReceived.length - 1]
            }`
          );
          killmailsReceived = []; // Reset the batch
        }
        lastSummaryTime = currentTime;
      }

      // Replace verbose structure logging with minimal logging
      logger.debug(
        {
          killmailId: redisQResponse.package.killID,
        },
        "Processing RedisQ killmail"
      );

      // Try to find the hash in different possible locations
      let hash = null;
      if (redisQResponse.package.hash) {
        hash = redisQResponse.package.hash;
      } else if (redisQResponse.package.zkb?.hash) {
        hash = redisQResponse.package.zkb.hash;
      } else if (redisQResponse.zkb?.hash) {
        hash = redisQResponse.zkb.hash;
      }

      // Validate that we found a hash somewhere
      if (!hash) {
        logger.warn(
          { killmailId: redisQResponse.package.killID },
          `Skipping killmail ${redisQResponse.package.killID}: missing hash required for ESI lookup`
        );
        setTimeout(() => pollRedisQ(ingestionService), 1000);
        return;
      }

      try {
        // The structure appears to be different than we expected
        // Let's properly extract and reformat the data
        const killmailData = redisQResponse.package.killmail || {};

        // Log minimal information about the killmail structure
        logger.debug(
          {
            killmailId: redisQResponse.package.killID,
            hasKillmailObject: Boolean(redisQResponse.package.killmail),
          },
          "Processing killmail data"
        );

        // Format it as a proper RedisQKillmail with the correct structure
        const killmail: RedisQKillmail = {
          killID: redisQResponse.package.killID,
          hash: hash,
          package: {
            killID: redisQResponse.package.killID,
            killmail_time:
              killmailData.killmail_time || new Date().toISOString(),
            solar_system_id: killmailData.solar_system_id || 0,
            // Correctly map the victim data
            victim: killmailData.victim
              ? {
                  character_id: killmailData.victim.character_id,
                  corporation_id: killmailData.victim.corporation_id,
                  alliance_id: killmailData.victim.alliance_id,
                  ship_type_id: killmailData.victim.ship_type_id || 0,
                  damage_taken: killmailData.victim.damage_taken || 0,
                  position: killmailData.victim.position || {
                    x: 0,
                    y: 0,
                    z: 0,
                  },
                  items: (killmailData.victim.items || []).map((item: any) => ({
                    type_id: item.item_type_id || 0,
                    flag: item.flag || 0,
                    quantity_destroyed: item.quantity_destroyed,
                    quantity_dropped: item.quantity_dropped,
                    singleton: item.singleton || 0,
                  })),
                }
              : {
                  ship_type_id: 0,
                  damage_taken: 0,
                  position: { x: 0, y: 0, z: 0 },
                  items: [],
                },
            // Correctly map the attackers data
            attackers: (killmailData.attackers || []).map((attacker: any) => ({
              character_id: attacker.character_id,
              corporation_id: attacker.corporation_id,
              alliance_id: attacker.alliance_id,
              damage_done: attacker.damage_done || 0,
              final_blow: attacker.final_blow || false,
              security_status: attacker.security_status || 0,
              ship_type_id: attacker.ship_type_id || 0,
              weapon_type_id: attacker.weapon_type_id || 0,
            })),
          },
        };

        await processKillmail(killmail);
      } catch (processError) {
        logger.error(
          {
            killmailId: redisQResponse.package.killID,
            error:
              processError instanceof Error
                ? processError.message
                : String(processError),
            stack:
              processError instanceof Error ? processError.stack : undefined,
            hashFound: Boolean(hash),
            dataStructure: {
              hasVictim: Boolean(redisQResponse.package.killmail?.victim),
              hasAttackers: Boolean(redisQResponse.package.killmail?.attackers),
              attackerCount:
                redisQResponse.package.killmail?.attackers?.length || 0,
              hashLocation: redisQResponse.package.hash
                ? "package.hash"
                : redisQResponse.package?.zkb?.hash
                ? "package.zkb.hash"
                : "zkb structure",
            },
          },
          "Error processing killmail in pollRedisQ"
        );
      }
    } else {
      // No package means no new killmail
      logger.debug("No new killmail received from RedisQ");
    }

    // Continue polling
    setTimeout(() => pollRedisQ(ingestionService), 1000);
  } catch (error) {
    const axiosError = error as any;

    // Determine if this is a connection error (which should be a warning)
    // or another type of error (which should be logged as an error)
    const errorMessage =
      axiosError?.message ||
      (error instanceof Error ? error.message : String(error));

    // Check for common connection error patterns
    const isConnectionError =
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ETIMEDOUT") ||
      errorMessage.includes("ENOTFOUND") ||
      errorMessage.includes("connect failed") ||
      axiosError?.code === "ECONNABORTED" ||
      axiosError?.response?.status === 429 || // Too many requests
      axiosError?.response?.status >= 500; // Server errors

    if (isConnectionError) {
      // Log connection issues as warnings since they're expected and we'll retry automatically
      logger.warn(
        {
          error: errorMessage,
          statusCode: axiosError?.response?.status,
          statusText: axiosError?.response?.statusText,
        },
        "RedisQ connection issue - will retry automatically"
      );
    } else {
      // Log unexpected errors at error level
      logger.error(
        {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          statusCode: axiosError?.response?.status,
          statusText: axiosError?.response?.statusText,
        },
        "Error polling RedisQ"
      );
    }

    // Retry after a longer delay when errors occur
    setTimeout(() => pollRedisQ(ingestionService), 5000);
  }
}
