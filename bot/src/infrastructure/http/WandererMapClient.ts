// import { UnifiedESIClient } from './UnifiedESIClient';

/**
 * WandererMapClient - Client for interacting with the Wanderer Map API
 * Renamed from MapClient to avoid confusion with JavaScript's Map class
 */
export class WandererMapClient {
  // private readonly _client: UnifiedESIClient;

  constructor(_baseUrl: string, _apiKey: string) {
    // _apiKey not used currently
    // this._client = new UnifiedESIClient({
    //   baseUrl,
    //   userAgent: 'EVE-Chart-Bot/1.0',
    //   timeout: 10000,
    // });
  }

  /**
   * Get data array from response, handling both array and object responses
   */
  // Method not used currently but kept for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // private _getDataArray(_response: any): any[] {
  //   if (Array.isArray(response)) {
  //     return response;
  //   }
  //   return response.data ?? [];
  //   return [];
  // }

  /**
   * All methods from the original MapClient remain the same
   * This is just a rename to improve clarity
   */

  // Export the old name for backward compatibility during migration
  static MapClient = WandererMapClient;
}

// Re-export as MapClient for backward compatibility
export { WandererMapClient as MapClient };
