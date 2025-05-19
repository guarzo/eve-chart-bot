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
      const url = `/kills/characterID/${characterId}/page/${page}/`;
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
          url: `/kills/characterID/${characterId}/page/${page}/`,
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
      return []; // Return empty array instead of throwing
    }
  }
}
