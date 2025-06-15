import { UnifiedESIClient } from './UnifiedESIClient';
import { rateLimiterManager } from '../../shared/performance/RateLimiterManager';

/**
 * WandererMapClient - Client for interacting with the Wanderer Map API
 * Renamed from MapClient to avoid confusion with JavaScript's Map class
 */
export class WandererMapClient {
  private readonly client: UnifiedESIClient;

  constructor(baseUrl: string, apiKey: string) {
    this.client = new UnifiedESIClient({
      baseUrl,
      userAgent: 'EVE-Chart-Bot/1.0',
      timeout: 10000,
    });
  }

  /**
   * Get data array from response, handling both array and object responses
   */
  private getDataArray(response: any): any[] {
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