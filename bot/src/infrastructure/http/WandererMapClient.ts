import { UnifiedESIClient } from './UnifiedESIClient';
import { MapActivityResponseSchema, UserCharactersResponseSchema } from '../../types/ingestion';
import { z } from 'zod';
import { logger } from '../../lib/logger';
import { RateLimiter } from '../../shared/performance/rateLimiter';
import { rateLimiterManager } from '../../shared/performance/RateLimiterManager';
import { errorHandler, ExternalServiceError, ValidationError } from '../../shared/errors';

// Infer types from schemas
type MapActivityResponse = z.infer<typeof MapActivityResponseSchema>;
type UserCharactersResponse = z.infer<typeof UserCharactersResponseSchema>;

// Define response type for raw API responses
interface RawApiResponse {
  data?: any[];
  [key: string]: any;
}

type ApiResponse = any[] | RawApiResponse;

/**
 * WandererMapClient - Client for interacting with the Wanderer Map API
 * Renamed from MapClient to avoid confusion with JavaScript's Map class
 */
export class WandererMapClient {
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
    this.rateLimiter = rateLimiterManager.getRateLimiter('Wanderer Map API');
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
   * All methods from the original MapClient remain the same
   * This is just a rename to improve clarity
   */

  // Export the old name for backward compatibility during migration
  static MapClient = WandererMapClient;
}

// Re-export as MapClient for backward compatibility
export { WandererMapClient as MapClient };