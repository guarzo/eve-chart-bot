import { UnifiedESIClient } from './UnifiedESIClient';
import { MapActivityResponseSchema, UserCharactersResponseSchema } from '../../types/ingestion';
import { z } from 'zod';
import { logger } from '../../lib/logger';
import { RateLimiter } from '../../shared/performance/rateLimiter';
import { rateLimiterManager } from '../../shared/performance/RateLimiterManager';
import { ExternalServiceError, ValidationError } from '../../shared/errors';
import * as crypto from 'crypto';

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
      userAgent: 'EVE-Chart-Bot/1.0',
      timeout: 10000,
    });

    // Use shared rate limiter from singleton manager
    this.rateLimiter = rateLimiterManager.getRateLimiter('Map API');
  }

  /**
   * Get data array from response, handling both array and object responses
   */
  private getDataArray(response: ApiResponse): any[] {
    if (Array.isArray(response)) {
      return response;
    }
    return response.data ?? [];
  }

  /**
   * Fetch character activity data from the Map API
   */
  async getCharacterActivity(slug: string, days: number = 7, signal?: AbortSignal): Promise<MapActivityResponse> {
    const correlationId = crypto.randomUUID();
    
    try {
      // Validate input parameters
      if (!slug || typeof slug !== 'string') {
        throw ValidationError.invalidFormat(
          'slug',
          'non-empty string',
          slug,
          {
            correlationId,
            operation: 'map.getCharacterActivity',
            metadata: { days },
          }
        );
      }
      
      if (days <= 0 || days > 365) {
        throw ValidationError.outOfRange(
          'days',
          1,
          365,
          days.toString(),
          {
            correlationId,
            operation: 'map.getCharacterActivity',
            metadata: { slug },
          }
        );
      }

      logger.info('Fetching character activity from Map API', {
        correlationId,
        slug,
        days,
      });

      // Respect rate limit with retry logic
      await this.rateLimiter.wait(signal);

      const url = `/api/map/character-activity?slug=${slug}&days=${days}`;
      const response = await this.client.fetch<ApiResponse>(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal,
      });

      if (response) {
        const dataArray = this.getDataArray(response);
        const dataCount = dataArray.length;
        
        logger.info('Received character activity data', {
          correlationId,
          dataCount,
          slug,
          days,
        });

        // Log date range in the response
        if (dataArray.length > 0) {
          const dates = dataArray.map((item: any) => new Date(item.timestamp));
          const oldestDate = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
          const newestDate = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
          
          logger.debug('Date range in response', {
            correlationId,
            oldestDate: oldestDate.toISOString(),
            newestDate: newestDate.toISOString(),
          });
        }

        // Try to validate the response against our schema
        try {
          const validated = MapActivityResponseSchema.parse(response);
          
          logger.info('Successfully validated character activity response', {
            correlationId,
            validatedRecords: validated.data.length,
          });
          
          return validated;
        } catch (schemaError) {
          throw ValidationError.fromZodError(
            schemaError,
            {
              correlationId,
              operation: 'map.validate.characterActivity',
              metadata: { 
                slug, 
                days, 
                responseDataCount: dataArray.length 
              },
            }
          );
        }
      }

      logger.warn('No data received from Map API', {
        correlationId,
        slug,
        days,
      });
      
      return { data: [] };
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
        throw ValidationError.invalidFormat(
          'slug',
          'non-empty string',
          slug,
          {
            correlationId,
            operation: 'map.getUserCharacters',
          }
        );
      }

      logger.info('Fetching user characters from Map API', {
        correlationId,
        slug,
      });

      // Respect rate limit with retry logic
      await this.rateLimiter.wait(signal);

      const response = await this.client.fetch<ApiResponse>('/api/map/user_characters', {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        params: {
          slug,
        },
        signal,
      });

      // Validate response against schema
      const parsedData = UserCharactersResponseSchema.parse(response);
      const totalCharacters = parsedData.data.reduce((acc, user) => acc + user.characters.length, 0);
      
      logger.info('Successfully fetched and validated user characters', {
        correlationId,
        userEntries: parsedData.data.length,
        totalCharacters,
        slug,
      });

      return parsedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ValidationError.fromZodError(
          error,
          {
            correlationId,
            operation: 'map.validate.userCharacters',
            metadata: { slug },
          }
        );
      }
      
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
