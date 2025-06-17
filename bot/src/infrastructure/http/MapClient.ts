import { TypeSafeHttpClient } from '../../shared/http/TypeSafeHttpClient';
import {
  MapActivityResponseSchema,
  UserCharactersResponseSchema,
  MapActivityResponse,
  UserCharactersResponse,
} from '../../shared/schemas/api-responses';
import { logger } from '../../lib/logger';
import { RateLimiter } from '../../shared/performance/rateLimiter';
import { rateLimiterManager } from '../../shared/performance/RateLimiterManager';
import { ExternalServiceError, ValidationError } from '../../shared/errors';
import * as crypto from 'crypto';

export class MapClient {
  private readonly client: TypeSafeHttpClient;
  private readonly rateLimiter: RateLimiter;

  constructor(baseUrl: string, apiKey: string) {
    this.client = new TypeSafeHttpClient({
      baseURL: baseUrl,
      timeout: 10000,
      retries: 3,
      apiKey: apiKey,
      headers: {
        'User-Agent': 'EVE-Chart-Bot/1.0',
      },
    });

    // Use shared rate limiter from singleton manager
    this.rateLimiter = rateLimiterManager.getRateLimiter('Map API');
  }

  /**
   * Fetch character activity data from the Map API
   */
  async getCharacterActivity(slug: string, days: number = 7, signal?: AbortSignal): Promise<MapActivityResponse> {
    const correlationId = crypto.randomUUID();

    try {
      // Validate input parameters
      if (!slug || typeof slug !== 'string') {
        throw ValidationError.invalidFormat('slug', 'non-empty string', slug, {
          correlationId,
          operation: 'map.getCharacterActivity',
          metadata: { days },
        });
      }

      if (days <= 0 || days > 365) {
        throw ValidationError.outOfRange('days', 1, 365, days.toString(), {
          correlationId,
          operation: 'map.getCharacterActivity',
          metadata: { slug },
        });
      }

      logger.info('Fetching character activity from Map API', {
        correlationId,
        slug,
        days,
      });

      // Respect rate limit with retry logic
      await this.rateLimiter.wait(signal);

      const url = `/api/map/character-activity?slug=${slug}&days=${days}`;
      const response = await this.client.get(url, MapActivityResponseSchema, undefined, { signal });

      const dataCount = response.data.length;

      logger.info('Received character activity data', {
        correlationId,
        dataCount,
        slug,
        days,
      });

      // Log date range in the response
      if (response.data.length > 0) {
        const dates = response.data.map(item => new Date(item.timestamp));
        const oldestDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const newestDate = new Date(Math.max(...dates.map(d => d.getTime())));

        logger.debug('Date range in response', {
          correlationId,
          oldestDate: oldestDate.toISOString(),
          newestDate: newestDate.toISOString(),
        });
      }

      logger.info('Successfully validated character activity response', {
        correlationId,
        validatedRecords: response.data.length,
      });

      return response;
    } catch (error) {
      throw ExternalServiceError.mapApiError(
        error instanceof Error ? error.message : 'Failed to get character activity',
        `/api/map/character-activity?slug=${slug}&days=${days}`,
        undefined,
        {
          correlationId,
          operation: 'getCharacterActivity',
          metadata: { slug, days },
        },
        error instanceof Error ? error : undefined
      );
    }
  }

  async getUserCharacters(slug: string, signal?: AbortSignal): Promise<UserCharactersResponse> {
    const correlationId = crypto.randomUUID();

    try {
      // Validate input parameters
      if (!slug || typeof slug !== 'string') {
        throw ValidationError.invalidFormat('slug', 'non-empty string', slug, {
          correlationId,
          operation: 'map.getUserCharacters',
        });
      }

      logger.info('Fetching user characters from Map API', {
        correlationId,
        slug,
      });

      // Respect rate limit with retry logic
      await this.rateLimiter.wait(signal);

      const url = `/api/map/user_characters?slug=${slug}`;
      const parsedData = await this.client.get(url, UserCharactersResponseSchema, undefined, { signal });
      const totalCharacters = parsedData.data.reduce((acc, user) => acc + user.characters.length, 0);

      logger.info('Successfully fetched and validated user characters', {
        correlationId,
        userEntries: parsedData.data.length,
        totalCharacters,
        slug,
      });

      return parsedData;
    } catch (error) {
      throw ExternalServiceError.mapApiError(
        error instanceof Error ? error.message : 'Failed to get user characters',
        '/api/map/user_characters',
        undefined,
        {
          correlationId,
          operation: 'getUserCharacters',
          metadata: { slug },
        },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Rate limiter is now managed by the singleton, no need to reset here
    // The manager will handle cleanup centrally
  }
}
