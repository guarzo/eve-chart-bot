import { UnifiedESIClient } from "./UnifiedESIClient";
import { logger } from "../../lib/logger";

export class ZkillClient {
  private readonly client: UnifiedESIClient;
  private lastRequestTime: number = 0;
  private readonly rateLimitMs: number = 1000; // 1 request per second

  constructor(baseUrl: string = "https://zkillboard.com/api") {
    this.client = new UnifiedESIClient({
      baseUrl,
      userAgent: "EVE-Chart-Bot/1.0",
      timeout: 15000,
    });
  }

  /**
   * Respect rate limits when making requests to zKillboard
   */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitMs) {
      const waitTime = this.rateLimitMs - timeSinceLastRequest;
      logger.debug(
        `Rate limiting - waiting ${waitTime}ms before next request to zKillboard`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Get a single killmail from zKillboard
   */
  async getKillmail(killId: number): Promise<any> {
    try {
      await this.respectRateLimit();
      logger.info(`Fetching killmail ${killId} from zKillboard`);

      const response = await this.client.fetch(`/killID/${killId}/`);
      return response;
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
  ): Promise<any[]> {
    try {
      await this.respectRateLimit();
      logger.info(
        `Fetching kills for character ${characterId} from zKillboard (page ${page})`
      );

      const response = await this.client.fetch(
        `/characterID/${characterId}/page/${page}/`
      );
      return Array.isArray(response) ? response : [];
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
  ): Promise<any[]> {
    try {
      await this.respectRateLimit();
      logger.info(
        `Fetching losses for character ${characterId} from zKillboard (page ${page})`
      );

      const response = await this.client.fetch(
        `/characterID/${characterId}/losses/page/${page}/`
      );
      return Array.isArray(response) ? response : [];
    } catch (error) {
      logger.error(
        `Error fetching losses for character ${characterId} from zKillboard:`,
        error
      );
      throw error;
    }
  }
}
