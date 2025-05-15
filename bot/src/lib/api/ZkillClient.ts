import axios, { AxiosInstance } from "axios";
import { ZkillResponseSchema } from "../../types/ingestion";
import { logger } from "../logger";

export class ZkillClient {
  private client: AxiosInstance;
  private lastRequestTime: number = 0;
  private readonly rateLimitMs: number = 100; // 10 requests per second

  constructor(baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Accept: "application/json",
        "User-Agent": "EVE-Chart-Bot/1.0",
      },
    });
  }

  private async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.rateLimitMs - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  async getKillmail(killId: number) {
    try {
      await this.rateLimit();
      const response = await this.client.get(`/killID/${killId}/`);

      // The response is an array with a single item
      const kill = response.data[0];
      if (!kill) {
        throw new Error(`No killmail found for ID ${killId}`);
      }

      try {
        const parsedKill = ZkillResponseSchema.parse(kill);
        return parsedKill;
      } catch (parseError) {
        logger.error(
          { error: parseError, killId },
          "Failed to parse killmail response"
        );
        throw parseError;
      }
    } catch (error: any) {
      logger.error(
        {
          error,
          killId,
          errorMessage: error?.message,
          errorStack: error?.stack,
        },
        "Failed to fetch killmail from zKillboard"
      );
      throw error;
    }
  }

  async getCharacterKills(characterId: number, page: number = 1) {
    try {
      logger.info(
        `Fetching kills for character ${characterId}, page ${page} from zKillboard API...`
      );
      await this.rateLimit();
      const url = `/characterID/${characterId}/page/${page}/`;
      logger.debug(`Making zKillboard request to: ${url}`);

      const response = await this.client.get(url);

      if (!response.data) {
        logger.warn(
          `Empty response from zKillboard for character ${characterId}`
        );
        return [];
      }

      logger.info(
        `Received ${response.data.length} kills for character ${characterId}`
      );
      return response.data;
    } catch (error: any) {
      logger.error(
        {
          error,
          characterId,
          page,
          errorMessage: error?.message,
          errorStack: error?.stack,
          url: `/characterID/${characterId}/page/${page}/`,
          statusCode: error?.response?.status,
          statusText: error?.response?.statusText,
        },
        "Failed to fetch character kills from zKillboard"
      );
      throw error;
    }
  }

  /**
   * Get losses for a character from zKillboard API
   */
  async getCharacterLosses(characterId: number, page: number = 1) {
    try {
      await this.rateLimit();
      logger.info(`Fetching losses for character ${characterId}, page ${page}`);

      const url = `/losses/characterID/${characterId}/page/${page}/`;
      logger.debug(`Making zKillboard request to: ${url}`);

      const response = await this.client.get(url);

      if (!response.data) {
        logger.warn(
          `Empty response from zKillboard for character ${characterId} losses`
        );
        return [];
      }

      logger.info(
        `Received ${
          response.data?.length || 0
        } losses for character ${characterId}`
      );
      return response.data;
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
          retryAfter: error?.response?.headers?.["retry-after"],
        },
        "Failed to fetch character losses from zKillboard"
      );
      throw error;
    }
  }
}
