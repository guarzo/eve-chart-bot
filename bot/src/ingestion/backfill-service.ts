import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { logger } from "../lib/logger";
import { fetchESIKillmail } from "../lib/esi";

const prisma = new PrismaClient();
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

interface zKillboardKill {
  killID: number;
  hash: string;
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
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processKillmail(kill: zKillboardKill) {
  try {
    // Check if we've already processed this killmail
    const existing = await prisma.killFact.findUnique({
      where: { killmail_id: BigInt(kill.killID) },
    });

    if (existing) {
      return;
    }

    // 1. Get ESI data for additional details
    const esiData = await fetchESIKillmail(kill.killID, kill.hash);

    // 2. Process victim data
    const victim = {
      characterId: kill.victim.character_id,
      corporationId: kill.victim.corporation_id,
      allianceId: kill.victim.alliance_id,
      shipTypeId: kill.victim.ship_type_id,
      damageTaken: kill.victim.damage_taken,
    };

    // 3. Process attackers
    const attackers = kill.attackers.map((attacker) => ({
      characterId: attacker.character_id,
      corporationId: attacker.corporation_id,
      allianceId: attacker.alliance_id,
      damageDone: attacker.damage_done,
      finalBlow: attacker.final_blow,
      securityStatus: attacker.security_status,
      shipTypeId: attacker.ship_type_id,
      weaponTypeId: attacker.weapon_type_id,
    }));

    // 4. Create character relationships
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
        .filter((a) => a.characterId)
        .map((a) => ({
          characterId: String(a.characterId!),
          role: "attacker",
        })),
    ];

    // Check if any of the involved characters are tracked
    const trackedCharacters = await prisma.character.findMany({
      where: {
        eveId: {
          in: characterRelations.map((rel) => rel.characterId),
        },
      },
    });

    if (trackedCharacters.length === 0) {
      return;
    }

    // 5. Create the kill fact entry in the database
    await prisma.killFact.create({
      data: {
        killmail_id: BigInt(kill.killID),
        kill_time: new Date(kill.killmail_time),
        system_id: kill.solar_system_id,
        total_value: BigInt(Math.round(kill.zkb.totalValue)),
        points: kill.zkb.points,
        npc: attackers.every((a) => !a.characterId), // NPC kill if no player attackers
        solo: attackers.length === 1, // Solo kill if only one attacker
        awox: false, // TODO: Implement AWOX detection
        ship_type_id: kill.victim.ship_type_id,
        character_id: BigInt(
          kill.attackers.find((a) => a.final_blow)?.character_id || 0
        ),
        labels: [],
      },
    });

    // Update checkpoint
    await prisma.ingestionCheckpoint.upsert({
      where: { streamName: "killmails" },
      update: {
        lastSeenId: BigInt(kill.killID),
        lastSeenTime: new Date(kill.killmail_time),
      },
      create: {
        streamName: "killmails",
        lastSeenId: BigInt(kill.killID),
        lastSeenTime: new Date(kill.killmail_time),
      },
    });

    logger.info(`Ingested killmail ${kill.killID}`);
  } catch (error) {
    logger.error(
      {
        error,
        killId: kill.killID,
        errorMessage: error instanceof Error ? error.message : error,
        errorStack: error instanceof Error ? error.stack : undefined,
      },
      "Failed to process killmail"
    );
  }
}

async function processKillmailWithRetry(
  kill: zKillboardKill,
  retryCount = 0
): Promise<void> {
  try {
    await processKillmail(kill);
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      logger.error("Max retries reached for killmail", {
        killmailId: kill.killID,
        error: error instanceof Error ? error.message : error,
      });
      return;
    }

    // Calculate exponential backoff delay
    const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
    logger.warn("Error processing killmail, retrying...", {
      killmailId: kill.killID,
      retryCount: retryCount + 1,
      delay,
      error: error instanceof Error ? error.message : error,
    });

    await sleep(delay);
    await processKillmailWithRetry(kill, retryCount + 1);
  }
}

async function fetchKillmails(
  characterId: number,
  page: number = 1
): Promise<zKillboardKill[]> {
  try {
    const response = await axios.get<zKillboardKill[]>(
      `https://zkillboard.com/api/characterID/${characterId}/page/${page}/`
    );
    return response.data;
  } catch (error) {
    logger.error("Error fetching killmails from zKillboard", {
      error: error instanceof Error ? error.message : error,
      characterId,
      page,
    });
    return [];
  }
}

async function fetchKillmailsWithRetry(
  characterId: number,
  page: number = 1,
  retryCount = 0
): Promise<zKillboardKill[]> {
  try {
    const response = await axios.get<zKillboardKill[]>(
      `https://zkillboard.com/api/characterID/${characterId}/page/${page}/`
    );
    return response.data;
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      logger.error("Max retries reached for zKillboard API", {
        characterId,
        page,
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }

    // Calculate exponential backoff delay
    const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
    logger.warn("Error fetching killmails, retrying...", {
      characterId,
      page,
      retryCount: retryCount + 1,
      delay,
      error: error instanceof Error ? error.message : error,
    });

    await sleep(delay);
    return fetchKillmailsWithRetry(characterId, page, retryCount + 1);
  }
}

/**
 * Process a loss killmail for a specific character
 * @param loss zKillboard loss data
 * @param characterId EVE character ID
 */
async function processLoss(loss: zKillboardKill, characterId: number) {
  try {
    // Check if we've already processed this loss
    const existing = await prisma.lossFact.findUnique({
      where: { killmail_id: BigInt(loss.killID) },
    });

    if (existing) {
      return;
    }

    // Only process losses where the victim is the tracked character
    if (loss.victim.character_id !== characterId) {
      return;
    }

    // Store the loss in the database
    await prisma.lossFact.create({
      data: {
        killmail_id: BigInt(loss.killID),
        character_id: BigInt(characterId),
        kill_time: new Date(loss.killmail_time),
        ship_type_id: loss.victim.ship_type_id,
        system_id: loss.solar_system_id,
        total_value: BigInt(Math.round(loss.zkb.totalValue)),
        attacker_count: loss.attackers.length,
        labels: [],
      },
    });

    logger.info(`Ingested loss ${loss.killID} for character ${characterId}`);
  } catch (error) {
    logger.error(
      {
        error,
        killId: loss.killID,
        characterId,
        errorMessage: error instanceof Error ? error.message : error,
        errorStack: error instanceof Error ? error.stack : undefined,
      },
      "Failed to process loss"
    );
  }
}

async function processLossWithRetry(
  loss: zKillboardKill,
  characterId: number,
  retryCount = 0
): Promise<void> {
  try {
    await processLoss(loss, characterId);
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      logger.error("Max retries reached for loss", {
        killmailId: loss.killID,
        characterId,
        error: error instanceof Error ? error.message : error,
      });
      return;
    }

    const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
    logger.info(`Retrying loss processing after ${delay}ms`, {
      killmailId: loss.killID,
      characterId,
      retryCount: retryCount + 1,
    });

    await sleep(delay);
    await processLossWithRetry(loss, characterId, retryCount + 1);
  }
}

/**
 * Fetch losses for a character from zKillboard API
 * @param characterId EVE character ID
 * @param page Page number for pagination
 * @returns Array of loss killmails
 */
async function fetchLosses(
  characterId: number,
  page: number = 1
): Promise<zKillboardKill[]> {
  const url = `https://zkillboard.com/api/losses/characterID/${characterId}/page/${page}/`;

  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "EVE-Chart-Bot v1.0 - github.com/yourusername/eve-chart-bot",
    },
  });

  return response.data;
}

/**
 * Fetch losses with retry mechanism
 * @param characterId EVE character ID
 * @param page Page number for pagination
 * @param retryCount Current retry attempt
 * @returns Array of loss killmails
 */
async function fetchLossesWithRetry(
  characterId: number,
  page: number = 1,
  retryCount = 0
): Promise<zKillboardKill[]> {
  try {
    return await fetchLosses(characterId, page);
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      logger.error("Max retries reached for fetching losses", {
        characterId,
        page,
        error: error instanceof Error ? error.message : error,
      });
      return [];
    }

    const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
    logger.info(`Retrying loss fetch after ${delay}ms`, {
      characterId,
      page,
      retryCount: retryCount + 1,
    });

    await sleep(delay);
    return fetchLossesWithRetry(characterId, page, retryCount + 1);
  }
}

/**
 * Backfill kill and loss data for a specific character
 * @param characterId EVE character ID
 */
async function backfillCharacter(characterId: number) {
  try {
    logger.info(`Starting backfill for character ${characterId}`);

    // Get last backfill timestamp for this character
    const character = await prisma.character.findUnique({
      where: { eveId: String(characterId) },
    });

    if (!character) {
      logger.warn(`Character ${characterId} not found in database`);
      return;
    }

    // Backfill kills
    let page = 1;
    let processedKills = 0;
    let keepFetching = true;

    while (keepFetching && page <= 5) {
      // Limit to 5 pages (500 killmails) per character to avoid excessive API calls
      const kills = await fetchKillmailsWithRetry(characterId, page);

      if (kills.length === 0) {
        keepFetching = false;
        continue;
      }

      for (const kill of kills) {
        await processKillmailWithRetry(kill);
        processedKills++;
      }

      page++;
      await sleep(1000); // Respect zKillboard rate limits
    }

    logger.info(
      `Processed ${processedKills} kills for character ${characterId}`
    );

    // Backfill losses
    page = 1;
    let processedLosses = 0;
    keepFetching = true;

    while (keepFetching && page <= 5) {
      // Limit to 5 pages (500 killmails) per character to avoid excessive API calls
      const losses = await fetchLossesWithRetry(characterId, page);

      if (losses.length === 0) {
        keepFetching = false;
        continue;
      }

      for (const loss of losses) {
        await processLossWithRetry(loss, characterId);
        processedLosses++;
      }

      page++;
      await sleep(1000); // Respect zKillboard rate limits
    }

    logger.info(
      `Processed ${processedLosses} losses for character ${characterId}`
    );

    // Update character's last backfill timestamp
    await prisma.character.update({
      where: { eveId: String(characterId) },
      data: { lastBackfillAt: new Date() },
    });

    logger.info(`Completed backfill for character ${characterId}`);

    // Update the character kills count query
    const characterKills = await prisma.killFact.count({
      where: { character_id: BigInt(character.eveId) },
    });

    // Update the recent kills query
    const recentKills = await prisma.killFact.findMany({
      take: 5,
      orderBy: { kill_time: "desc" },
    });

    logger.info("Recent kills:");
    for (const kill of recentKills) {
      logger.info(
        `Kill ID: ${kill.killmail_id}, Character ID: ${kill.character_id}, Time: ${kill.kill_time}, Value: ${kill.total_value}`
      );
    }
  } catch (error) {
    logger.error("Error in backfill for character", {
      characterId,
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function startBackfill() {
  try {
    // Get all characters from the database
    const characters = await prisma.character.findMany();
    logger.info(`Found ${characters.length} characters to process`);

    let totalKills = 0;
    let processedCharacters = 0;

    // Process each character
    for (const character of characters) {
      try {
        logger.info(
          `Processing kills for character: ${character.name} (${character.eveId})`
        );
        await backfillCharacter(parseInt(character.eveId));

        // Count kills for this character
        const characterKills = await prisma.killFact.count({
          where: { character_id: BigInt(character.eveId) },
        });

        totalKills += characterKills;
        processedCharacters++;

        logger.info(`Processed ${characterKills} kills for ${character.name}`);
      } catch (error) {
        logger.error(
          { error, characterId: character.eveId },
          `Failed to process character ${character.name} (${character.eveId})`
        );
      }
    }

    logger.info(
      `Processed ${totalKills} kills for ${processedCharacters} characters`
    );
  } catch (error) {
    logger.error("Error in backfill", {
      error: error instanceof Error ? error.message : error,
    });
  }
}
