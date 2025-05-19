import axios from "axios";
import {
  MapActivityResponseSchema,
  UserCharactersResponseSchema,
} from "../../types/ingestion";
import { logger } from "../logger";

export class MapClient {
  private baseUrl: string;
  private apiKey: string;
  private lastRequestTime: number = 0;
  private readonly rateLimitMs: number = 200; // 5 requests per second

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Respect rate limits when making requests to the Map API
   */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitMs) {
      const waitTime = this.rateLimitMs - timeSinceLastRequest;
      logger.debug(
        `Rate limiting - waiting ${waitTime}ms before next request to Map API`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch character activity data from the Map API
   */
  async getCharacterActivity(slug: string, days: number = 7): Promise<any> {
    try {
      logger.info(
        `Fetching character activity for map: ${slug}, days: ${days}`
      );

      // Respect rate limit
      await this.respectRateLimit();

      // Use only the working endpoint
      const url = `${this.baseUrl}/api/map/character-activity?slug=${slug}&days=${days}`;

      logger.info(`Calling map API endpoint: ${url}`);
      logger.debug(`API key starting with: ${this.apiKey.substring(0, 5)}...`);

      const response = await axios.get(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 10000, // 10 second timeout
      });

      if (response.data) {
        // Log sample of the data to help debugging
        const dataCount = Array.isArray(response.data)
          ? response.data.length
          : response.data.data
          ? response.data.data.length
          : "unknown";
        logger.info(`Received ${dataCount} records in response`);

        // Log date range in the response
        if (Array.isArray(response.data) && response.data.length > 0) {
          const dates = response.data.map(
            (item: any) => new Date(item.timestamp)
          );
          const oldestDate = new Date(
            Math.min(...dates.map((d: Date) => d.getTime()))
          );
          const newestDate = new Date(
            Math.max(...dates.map((d: Date) => d.getTime()))
          );
          logger.info(
            `Date range in response: ${oldestDate.toISOString()} to ${newestDate.toISOString()}`
          );
        } else if (response.data.data && response.data.data.length > 0) {
          const dates = response.data.data.map(
            (item: any) => new Date(item.timestamp)
          );
          const oldestDate = new Date(
            Math.min(...dates.map((d: Date) => d.getTime()))
          );
          const newestDate = new Date(
            Math.max(...dates.map((d: Date) => d.getTime()))
          );
          logger.info(
            `Date range in response: ${oldestDate.toISOString()} to ${newestDate.toISOString()}`
          );
        }

        // Try to validate the response against our schema
        try {
          const validated = MapActivityResponseSchema.parse(response.data);
          logger.info(
            `Successfully validated response with ${validated.data.length} activity records`
          );
          return validated;
        } catch (schemaError) {
          logger.error(
            `Schema validation error for map activity response:`,
            schemaError
          );
          // Return the raw data anyway to see what we're getting
          return response.data;
        }
      }

      logger.warn(`No data received from map API`);
      return { data: [] };
    } catch (error) {
      logger.error(`Error fetching character activity from Map API:`, error);
      throw error;
    }
  }

  async getUserCharacters(slug: string) {
    try {
      await this.respectRateLimit();
      logger.info(`Fetching user characters for slug: ${slug}`);
      const response = await axios.get(
        `${this.baseUrl}/api/map/user_characters`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "EVE-Chart-Bot/1.0",
            Authorization: `Bearer ${this.apiKey}`,
          },
          params: {
            slug,
          },
        }
      );

      const parsedData = UserCharactersResponseSchema.parse(response.data);
      logger.info(`Parsed ${parsedData.data.length} user entries`);
      logger.info(
        `Total characters: ${parsedData.data.reduce(
          (acc, user) => acc + user.characters.length,
          0
        )}`
      );

      return parsedData;
    } catch (error) {
      logger.error(
        { error, slug },
        "Failed to fetch user characters from Map API"
      );
      throw error;
    }
  }
}
