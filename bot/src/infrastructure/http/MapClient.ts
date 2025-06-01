import { UnifiedESIClient } from "./UnifiedESIClient";
import {
  MapActivityResponseSchema,
  UserCharactersResponseSchema,
} from "../../types/ingestion";
import { z } from "zod";
import { logger } from "../../lib/logger";
import { RateLimiter } from "../../utils/rateLimiter";

// Infer types from schemas
type MapActivityResponse = z.infer<typeof MapActivityResponseSchema>;
type UserCharactersResponse = z.infer<typeof UserCharactersResponseSchema>;

// Define response type for raw API responses
interface RawApiResponse {
  data?: any[];
  [key: string]: any;
}

type ApiResponse = any[] | RawApiResponse;

export class MapClient {
  private readonly client: UnifiedESIClient;
  private readonly apiKey: string;
  private readonly rateLimiter: RateLimiter;

  constructor(baseUrl: string, apiKey: string) {
    this.apiKey = apiKey;
    this.client = new UnifiedESIClient({
      baseUrl,
      userAgent: "EVE-Chart-Bot/1.0",
      timeout: 10000,
    });

    // Use shared rate limiter with 200ms delay (5 requests per second)
    this.rateLimiter = new RateLimiter(200, "Map API");
  }

  /**
   * Get data array from response, handling both array and object responses
   */
  private getDataArray(response: ApiResponse): any[] {
    if (Array.isArray(response)) {
      return response;
    }
    return response.data || [];
  }

  /**
   * Fetch character activity data from the Map API
   */
  async getCharacterActivity(
    slug: string,
    days: number = 7
  ): Promise<MapActivityResponse> {
    try {
      logger.info(
        `Fetching character activity for map: ${slug}, days: ${days}`
      );

      // Respect rate limit
      await this.rateLimiter.wait();

      const url = `/api/map/character-activity?slug=${slug}&days=${days}`;
      const response = await this.client.fetch<ApiResponse>(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (response) {
        const dataArray = this.getDataArray(response);
        const dataCount = dataArray.length;
        logger.info(`Received ${dataCount} records in response`);

        // Log date range in the response
        if (dataArray.length > 0) {
          const dates = dataArray.map((item: any) => new Date(item.timestamp));
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
          const validated = MapActivityResponseSchema.parse(response);
          logger.info(
            `Successfully validated response with ${validated.data.length} activity records`
          );
          return validated;
        } catch (schemaError) {
          logger.error(
            `Schema validation error for map activity response:`,
            schemaError
          );
          // Return empty data array if validation fails
          return { data: [] };
        }
      }

      logger.warn(`No data received from map API`);
      return { data: [] };
    } catch (error) {
      logger.error(`Error fetching character activity from Map API:`, error);
      throw error;
    }
  }

  async getUserCharacters(slug: string): Promise<UserCharactersResponse> {
    try {
      await this.rateLimiter.wait();
      logger.info(`Fetching user characters for slug: ${slug}`);

      const response = await this.client.fetch<ApiResponse>(
        "/api/map/user_characters",
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          params: {
            slug,
          },
        }
      );

      const parsedData = UserCharactersResponseSchema.parse(response);
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
