import { UnifiedESIClient } from "./UnifiedESIClient";
import { logger } from "../../lib/logger";
import { RateLimiter } from "../../utils/rateLimiter";
import { RATE_LIMIT_MIN_DELAY } from "../../config";

interface ZkillResponse {
  killID: number;
  killmail_id: number;
  zkb: {
    hash: string;
    totalValue: number;
    points: number;
    labels?: string[];
  };
  [key: string]: any; // Allow additional fields
}

export class ZkillClient {
  private readonly client: UnifiedESIClient;
  private readonly rateLimiter: RateLimiter;

  constructor(baseUrl: string = "https://zkillboard.com/api") {
    this.client = new UnifiedESIClient({
      baseUrl,
      userAgent: "EVE-Chart-Bot/1.0",
      timeout: 15000,
    });

    // Use shared rate limiter with 1 second delay for zKillboard
    this.rateLimiter = new RateLimiter(RATE_LIMIT_MIN_DELAY, "zKillboard");
  }

  /**
   * Get a single killmail from zKillboard
   */
  async getKillmail(killId: number): Promise<ZkillResponse | null> {
    try {
      await this.rateLimiter.wait();
      logger.info(`Fetching killmail ${killId} from zKillboard`);

      const response = await this.client.fetch<Record<string, any>>(
        `/killID/${killId}/`
      );

      // Log the raw response for debugging
      logger.debug(
        `Raw zKill response for killmail ${killId}:`,
        JSON.stringify(response, null, 2)
      );

      // Validate response structure
      if (!response || typeof response !== "object") {
        logger.warn(`Invalid response format for killmail ${killId}`);
        return null;
      }

      // The response might be wrapped in an object with the killID as the key
      const killData = response[killId.toString()] || response;

      if (!killData || typeof killData !== "object") {
        logger.warn(`Invalid kill data format for killmail ${killId}`);
        return null;
      }

      // Log the kill data structure
      logger.debug(`Kill data structure for ${killId}:`, {
        hasKillmailId: !!killData.killmail_id,
        hasZkb: !!killData.zkb,
        hasHash: !!killData.zkb?.hash,
        keys: Object.keys(killData),
        zkbKeys: killData.zkb ? Object.keys(killData.zkb) : [],
      });

      // Ensure required fields exist
      if (!killData.killmail_id || !killData.zkb || !killData.zkb.hash) {
        logger.warn(`Missing required fields for killmail ${killId}`, {
          killmail_id: killData.killmail_id,
          hasZkb: !!killData.zkb,
          hasHash: !!killData.zkb?.hash,
        });
        return null;
      }

      // Ensure the killID matches
      if (killData.killID !== killId) {
        logger.warn(`KillID mismatch for killmail ${killId}`, {
          expected: killId,
          actual: killData.killID,
        });
        return null;
      }

      return killData as ZkillResponse;
    } catch (error) {
      logger.error(`Error fetching killmail ${killId} from zKillboard:`, error);
      throw error;
    }
  }

  /**
   * Get kills for a character from zKillboard
   */
  async getCharacterKills(
    characterId: number,
    page: number = 1
  ): Promise<ZkillResponse[]> {
    try {
      await this.rateLimiter.wait();
      logger.info(
        `Fetching kills for character ${characterId} from zKillboard (page ${page})`
      );

      const response = await this.client.fetch<Record<string, any>>(
        `/characterID/${characterId}/page/${page}/`
      );

      // Log the raw response for debugging
      logger.debug(
        `Raw zKill response for character ${characterId} kills:`,
        JSON.stringify(response, null, 2)
      );

      if (!response || typeof response !== "object") {
        logger.warn(
          `Invalid response format for character ${characterId} kills`
        );
        return [];
      }

      // Convert object response to array
      const kills = Object.values(response).filter((kill) => {
        const isValid =
          kill &&
          typeof kill === "object" &&
          kill.killmail_id &&
          kill.zkb &&
          kill.zkb.hash;

        if (!isValid) {
          logger.debug(`Invalid kill entry:`, {
            hasKillmailId: !!kill?.killmail_id,
            hasZkb: !!kill?.zkb,
            hasHash: !!kill?.zkb?.hash,
            keys: kill ? Object.keys(kill) : [],
          });
        }

        return isValid;
      }) as ZkillResponse[];

      return kills;
    } catch (error) {
      logger.error(
        `Error fetching kills for character ${characterId} from zKillboard:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get losses for a character from zKillboard
   */
  async getCharacterLosses(
    characterId: number,
    page: number = 1
  ): Promise<ZkillResponse[]> {
    try {
      await this.rateLimiter.wait();
      logger.info(
        `Fetching losses for character ${characterId} from zKillboard (page ${page})`
      );

      const response = await this.client.fetch<Record<string, any>>(
        `/losses/characterID/${characterId}/page/${page}/`
      );

      // Log the raw response for debugging
      logger.debug(
        `Raw zKill response for character ${characterId} losses:`,
        JSON.stringify(response, null, 2)
      );

      if (!response || typeof response !== "object") {
        logger.warn(
          `Invalid response format for character ${characterId} losses`
        );
        return [];
      }

      // Convert object response to array
      const losses = Object.values(response).filter((kill) => {
        const isValid =
          kill &&
          typeof kill === "object" &&
          kill.killmail_id &&
          kill.zkb &&
          kill.zkb.hash;

        if (!isValid) {
          logger.debug(`Invalid loss entry:`, {
            hasKillmailId: !!kill?.killmail_id,
            hasZkb: !!kill?.zkb,
            hasHash: !!kill?.zkb?.hash,
            keys: kill ? Object.keys(kill) : [],
          });
        }

        return isValid;
      }) as ZkillResponse[];

      return losses;
    } catch (error) {
      logger.error(
        `Error fetching losses for character ${characterId} from zKillboard:`,
        error
      );
      throw error;
    }
  }
}
