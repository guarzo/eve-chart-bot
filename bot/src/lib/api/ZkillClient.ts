import axios, { AxiosInstance } from "axios";
import {
  CompleteKillmailSchema,
  BasicKillmailSchema,
} from "../../types/ingestion";
import { logger } from "../logger";
import { fetchESIKillmail } from "../../lib/esi";

export class ZkillClient {
  private client: AxiosInstance;
  private lastRequestTime: number = 0;
  private readonly rateLimitMs: number = 200; // 5 requests per second to be more conservative

  constructor(baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Accept: "application/json",
        "User-Agent": "EVE-Chart-Bot/1.0",
      },
      timeout: 30000, // 30 second timeout
    });
    logger.info(`ZkillClient initialized with base URL: ${baseUrl}`);
  }

  /**
   * Pause between requests to respect rate limit
   */
  private async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitMs) {
      const delay = this.rateLimitMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    this.lastRequestTime = Date.now();
  }

  async getKillmail(killId: number) {
    try {
      await this.rateLimit();
      logger.info(`Fetching killmail ${killId} from zKillboard API...`);

      const response = await this.client.get(`/killID/${killId}/`);

      // The response is an array with a single item
      const kill = response.data[0];
      if (!kill) {
        logger.warn(`No killmail found for ID ${killId}`);
        return null;
      }

      try {
        // First validate the basic zKillboard response
        const basicKill = BasicKillmailSchema.parse(kill);

        // Then fetch complete killmail data from ESI
        const esiData = await fetchESIKillmail(
          basicKill.killmail_id,
          basicKill.zkb.hash
        );

        if (!esiData) {
          logger.warn(
            `Failed to fetch ESI data for killmail ${basicKill.killmail_id}`
          );
          return null;
        }

        // Transform ESI data to match our schema
        const transformedEsiData = {
          killmail_time: esiData.killmail_time,
          solar_system_id: esiData.solar_system_id,
          victim: esiData.victim
            ? {
                character_id: esiData.victim.character_id,
                corporation_id: esiData.victim.corporation_id,
                alliance_id: esiData.victim.alliance_id,
                ship_type_id: esiData.victim.ship_type_id,
                damage_taken: esiData.victim.damage_taken,
                position: esiData.victim.position,
                items: esiData.victim.items.map((item) => ({
                  type_id: item.type_id,
                  flag: item.flag,
                  quantity_destroyed: item.quantity_destroyed,
                  quantity_dropped: item.quantity_dropped,
                  singleton: item.singleton,
                })),
              }
            : undefined,
          attackers: esiData.attackers.map((attacker) => ({
            character_id: attacker.character_id,
            corporation_id: attacker.corporation_id,
            alliance_id: attacker.alliance_id,
            damage_done: attacker.damage_done,
            final_blow: attacker.final_blow,
            security_status: attacker.security_status,
            ship_type_id: attacker.ship_type_id,
            weapon_type_id: attacker.weapon_type_id,
          })),
        };

        // Combine the data and validate the complete killmail
        const completeKill = {
          ...basicKill,
          ...transformedEsiData,
        };

        return CompleteKillmailSchema.parse(completeKill);
      } catch (parseError) {
        logger.warn(
          {
            error: parseError,
            killId,
            rawData: kill,
            expectedFields: Object.keys(BasicKillmailSchema.shape),
          },
          "Failed to parse killmail response"
        );
        return null;
      }
    } catch (error: any) {
      logger.error(
        {
          error,
          killId,
          errorMessage: error?.message,
          errorStack: error?.stack,
          status: error?.response?.status,
          url: `/killID/${killId}/`,
        },
        "Failed to fetch killmail from zKillboard"
      );
      return null;
    }
  }

  async getCharacterKills(characterId: number, page: number = 1) {
    try {
      logger.info(
        `Fetching kills for character ${characterId}, page ${page} from zKillboard API...`
      );
      await this.rateLimit();

      // Use the endpoint that we've found to work in diagnostics
      const url = `/api/characterID/${characterId}/page/${page}/`;
      logger.debug(`Making zKillboard request to: ${url}`);

      const response = await this.client.get(url, {
        timeout: 30000, // 30 second timeout
      });

      if (!response.data) {
        logger.warn(
          `Empty response from zKillboard for character ${characterId}`
        );
        return [];
      }

      logger.debug(
        `Received ${response.data.length} raw kills from zKillboard`
      );

      // Process each kill by fetching complete data from ESI
      const validatedKills = [];
      for (const kill of response.data) {
        try {
          // First validate the basic zKillboard response
          const basicKill = BasicKillmailSchema.parse(kill);

          // Then fetch complete killmail data from ESI
          await this.rateLimit(); // Add rate limiting before ESI request
          const esiData = await fetchESIKillmail(
            basicKill.killmail_id,
            basicKill.zkb.hash
          );

          if (!esiData) {
            logger.warn(
              `Failed to fetch ESI data for killmail ${basicKill.killmail_id}`
            );
            continue;
          }

          // Transform ESI data to match our schema
          const transformedEsiData = {
            killmail_time: esiData.killmail_time,
            solar_system_id: esiData.solar_system_id,
            victim: esiData.victim
              ? {
                  character_id: esiData.victim.character_id,
                  corporation_id: esiData.victim.corporation_id,
                  alliance_id: esiData.victim.alliance_id,
                  ship_type_id: esiData.victim.ship_type_id,
                  damage_taken: esiData.victim.damage_taken,
                  position: esiData.victim.position,
                  items: esiData.victim.items.map((item) => ({
                    type_id: item.type_id,
                    flag: item.flag,
                    quantity_destroyed: item.quantity_destroyed,
                    quantity_dropped: item.quantity_dropped,
                    singleton: item.singleton,
                  })),
                }
              : undefined,
            attackers: esiData.attackers.map((attacker) => ({
              character_id: attacker.character_id,
              corporation_id: attacker.corporation_id,
              alliance_id: attacker.alliance_id,
              damage_done: attacker.damage_done,
              final_blow: attacker.final_blow,
              security_status: attacker.security_status,
              ship_type_id: attacker.ship_type_id,
              weapon_type_id: attacker.weapon_type_id,
            })),
          };

          // Combine the data and validate the complete killmail
          const completeKill = {
            ...basicKill,
            ...transformedEsiData,
          };

          validatedKills.push(CompleteKillmailSchema.parse(completeKill));
        } catch (parseError) {
          logger.warn(
            {
              error: parseError,
              killId: kill.killmail_id,
              rawData: kill,
              expectedFields: Object.keys(BasicKillmailSchema.shape),
            },
            "Failed to parse killmail response"
          );
        }
      }

      logger.info(
        `Received ${validatedKills.length} valid kills for character ${characterId}`
      );
      return validatedKills;
    } catch (error: any) {
      logger.error(
        {
          error,
          characterId,
          page,
          errorMessage: error?.message,
          errorStack: error?.stack,
          url: `/api/characterID/${characterId}/page/${page}/`,
          statusCode: error?.response?.status,
          statusText: error?.response?.statusText,
        },
        "Failed to fetch character kills from zKillboard"
      );
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Get losses for a character from zKillboard API
   */
  async getCharacterLosses(characterId: number, page: number = 1) {
    try {
      await this.rateLimit();
      logger.info(
        `Fetching losses for character ${characterId}, page ${page} from zKillboard API...`
      );

      const url = `/losses/characterID/${characterId}/page/${page}/`;
      logger.debug(`Making zKillboard request to: ${url}`);

      const response = await this.client.get(url);

      if (!response.data) {
        logger.warn(
          `Empty response from zKillboard for character ${characterId}`
        );
        return [];
      }

      // Process each loss by fetching complete data from ESI
      const validatedLosses = await Promise.all(
        response.data.map(async (kill: any) => {
          try {
            // First validate the basic zKillboard response
            const basicKill = BasicKillmailSchema.parse(kill);

            // Then fetch complete killmail data from ESI
            const esiData = await fetchESIKillmail(
              basicKill.killmail_id,
              basicKill.zkb.hash
            );

            if (!esiData) {
              logger.warn(
                `Failed to fetch ESI data for killmail ${basicKill.killmail_id}`
              );
              return null;
            }

            // Transform ESI data to match our schema
            const transformedEsiData = {
              killmail_time: esiData.killmail_time,
              solar_system_id: esiData.solar_system_id,
              victim: esiData.victim
                ? {
                    character_id: esiData.victim.character_id,
                    corporation_id: esiData.victim.corporation_id,
                    alliance_id: esiData.victim.alliance_id,
                    ship_type_id: esiData.victim.ship_type_id,
                    damage_taken: esiData.victim.damage_taken,
                    position: esiData.victim.position,
                    items: esiData.victim.items.map((item) => ({
                      type_id: item.type_id,
                      flag: item.flag,
                      quantity_destroyed: item.quantity_destroyed,
                      quantity_dropped: item.quantity_dropped,
                      singleton: item.singleton,
                    })),
                  }
                : undefined,
              attackers: esiData.attackers.map((attacker) => ({
                character_id: attacker.character_id,
                corporation_id: attacker.corporation_id,
                alliance_id: attacker.alliance_id,
                damage_done: attacker.damage_done,
                final_blow: attacker.final_blow,
                security_status: attacker.security_status,
                ship_type_id: attacker.ship_type_id,
                weapon_type_id: attacker.weapon_type_id,
              })),
            };

            // Combine the data and validate the complete killmail
            const completeKill = {
              ...basicKill,
              ...transformedEsiData,
            };

            return CompleteKillmailSchema.parse(completeKill);
          } catch (parseError) {
            logger.warn(
              {
                error: parseError,
                killId: kill.killmail_id,
                rawData: kill,
                expectedFields: Object.keys(BasicKillmailSchema.shape),
              },
              "Failed to parse killmail response"
            );
            return null;
          }
        })
      );

      const validLosses = validatedLosses.filter(
        (kill): kill is NonNullable<typeof kill> => kill !== null
      );

      logger.info(
        `Received ${validLosses.length} valid losses for character ${characterId}`
      );
      return validLosses;
    } catch (error: any) {
      logger.error(
        {
          error,
          characterId,
          page,
          errorMessage: error?.message,
          errorStack: error?.stack,
          url: `/losses/characterID/${characterId}/page/${page}/`,
          statusCode: error?.response?.status,
          statusText: error?.response?.statusText,
        },
        "Failed to fetch character losses from zKillboard"
      );
      return []; // Return empty array instead of throwing
    }
  }
}
