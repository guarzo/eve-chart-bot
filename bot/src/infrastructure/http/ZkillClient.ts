import { UnifiedESIClient } from './UnifiedESIClient';
import { logger } from '../../lib/logger';
import { RateLimiter } from '../../shared/performance/rateLimiter';
import { rateLimiterManager } from '../../shared/performance/RateLimiterManager';
import { RATE_LIMIT_MIN_DELAY } from '../../config';
import { ExternalServiceError, ValidationError } from '../../shared/errors';
import * as crypto from 'crypto';

interface ZkillResponse {
  killID: number;
  killmail_id: number;
  zkb: {
    hash: string;
    totalValue: number;
    points: number;
    labels?: string[];
  };
  [key: string]: any; // Allow additional fields
}

export class ZkillClient {
  private readonly client: UnifiedESIClient;
  private readonly rateLimiter: RateLimiter;

  constructor(baseUrl: string = 'https://zkillboard.com/api') {
    this.client = new UnifiedESIClient({
      baseUrl,
      userAgent: 'EVE-Chart-Bot/1.0',
      timeout: 15000,
    });

    // Use shared rate limiter from singleton manager
    // Override the default delay with config value if needed
    this.rateLimiter = rateLimiterManager.getRateLimiter('zKillboard', {
      minDelayMs: RATE_LIMIT_MIN_DELAY,
    });
  }

  /**
   * Get a single killmail from zKillboard
   */
  async getKillmail(killId: number, signal?: AbortSignal): Promise<ZkillResponse | null> {
    const correlationId = crypto.randomUUID();
    
    try {
      // Validate input
      if (!killId || killId <= 0) {
        throw ValidationError.invalidFormat(
          'killId',
          'positive integer',
          killId.toString(),
          {
            correlationId,
            operation: 'zkill.getKillmail',
          }
        );
      }

      logger.info('Fetching killmail from zKillboard', {
        correlationId,
        killId,
      });

      // Apply rate limiting with retry
      await this.rateLimiter.wait(signal);

      const response = await this.client.fetch<Record<string, any>>(`/killID/${killId}/`, { signal });

      logger.debug('Raw zKill response received', {
        correlationId,
        killId,
        responseType: typeof response,
        hasData: !!response,
      });

      // Validate response structure
      if (!response || typeof response !== 'object') {
        logger.warn('Invalid response format from zKillboard', {
          correlationId,
          killId,
          responseType: typeof response,
        });
        return null;
      }

      // The response might be wrapped in an object with the killID as the key
      const killData = response[killId.toString()] || response;

      if (!killData || typeof killData !== 'object') {
        logger.warn('Invalid kill data format from zKillboard', {
          correlationId,
          killId,
          killDataType: typeof killData,
        });
        return null;
      }

      logger.debug('Kill data structure validation', {
        correlationId,
        killId,
        hasKillmailId: !!killData.killmail_id,
        hasZkb: !!killData.zkb,
        hasHash: !!killData.zkb?.hash,
        keys: Object.keys(killData),
        zkbKeys: killData.zkb ? Object.keys(killData.zkb) : [],
      });

      // Ensure required fields exist
      if (!killData.killmail_id || !killData.zkb?.hash) {
        throw ValidationError.fieldRequired(
          'killmail_id or zkb.hash',
          {
            correlationId,
            operation: 'zkill.validate.killmail',
            metadata: {
              killId,
              hasKillmailId: !!killData.killmail_id,
              hasZkb: !!killData.zkb,
              hasHash: !!killData.zkb?.hash,
            },
          }
        );
      }

      // Ensure the killID matches
      if (killData.killID !== killId) {
        throw ValidationError.invalidFormat(
          'killID',
          killId.toString(),
          killData.killID?.toString(),
          {
            correlationId,
            operation: 'zkill.validate.killIdMatch',
            metadata: { expectedKillId: killId, actualKillId: killData.killID },
          }
        );
      }

      logger.debug('Successfully validated killmail data', {
        correlationId,
        killId,
        killmailId: killData.killmail_id,
        hash: killData.zkb.hash,
      });

      return killData as ZkillResponse;
    } catch (error) {
      throw ExternalServiceError.zkillError(
        error instanceof Error ? error.message : 'Failed to get killmail',
        `/killID/${killId}/`,
        undefined,
        {
          correlationId,
          operation: 'getKillmail',
          metadata: { killId },
        },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get kills for a character from zKillboard
   */
  async getCharacterKills(characterId: number, page: number = 1, signal?: AbortSignal): Promise<ZkillResponse[]> {
    const correlationId = crypto.randomUUID();
    
    try {
      // Validate input
      if (!characterId || characterId <= 0) {
        throw ValidationError.invalidFormat(
          'characterId',
          'positive integer',
          characterId.toString(),
          {
            correlationId,
            operation: 'zkill.getCharacterKills',
            metadata: { page },
          }
        );
      }
      
      if (page <= 0) {
        throw ValidationError.outOfRange(
          'page',
          1,
          Number.MAX_SAFE_INTEGER,
          page.toString(),
          {
            correlationId,
            operation: 'zkill.getCharacterKills',
            metadata: { characterId },
          }
        );
      }

      logger.info('Fetching character kills from zKillboard', {
        correlationId,
        characterId,
        page,
      });

      // Apply rate limiting with retry
      await this.rateLimiter.wait(signal);

      const response = await this.client.fetch<Record<string, any>>(`/characterID/${characterId}/page/${page}/`, {
        signal,
      });

      logger.debug('Raw zKill character kills response received', {
        correlationId,
        characterId,
        page,
        responseType: typeof response,
        hasData: !!response,
      });

      if (!response || typeof response !== 'object') {
        logger.warn('Invalid response format for character kills', {
          correlationId,
          characterId,
          page,
          responseType: typeof response,
        });
        return [];
      }

      // Convert object response to array and validate
      const kills = Object.values(response).filter(kill => {
        const isValid = kill && typeof kill === 'object' && kill.killmail_id && kill.zkb?.hash;

        if (!isValid) {
          logger.debug('Invalid kill entry found', {
            correlationId,
            hasKillmailId: !!kill?.killmail_id,
            hasZkb: !!kill?.zkb,
            hasHash: !!kill?.zkb?.hash,
            keys: kill ? Object.keys(kill) : [],
          });
        }

        return isValid;
      }) as ZkillResponse[];

      logger.info('Successfully fetched and validated character kills', {
        correlationId,
        characterId,
        page,
        validKills: kills.length,
        totalEntries: Object.keys(response).length,
      });

      return kills;
    } catch (error) {
      throw ExternalServiceError.zkillError(
        error instanceof Error ? error.message : 'Failed to get character kills',
        `/characterID/${characterId}/page/${page}/`,
        undefined,
        {
          correlationId,
          operation: 'getCharacterKills',
          metadata: { characterId, page },
        },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get losses for a character from zKillboard
   */
  async getCharacterLosses(characterId: number, page: number = 1, signal?: AbortSignal): Promise<ZkillResponse[]> {
    const correlationId = crypto.randomUUID();
    
    try {
      // Validate input
      if (!characterId || characterId <= 0) {
        throw ValidationError.invalidFormat(
          'characterId',
          'positive integer',
          characterId.toString(),
          {
            correlationId,
            operation: 'zkill.getCharacterLosses',
            metadata: { page },
          }
        );
      }
      
      if (page <= 0) {
        throw ValidationError.outOfRange(
          'page',
          1,
          Number.MAX_SAFE_INTEGER,
          page.toString(),
          {
            correlationId,
            operation: 'zkill.getCharacterLosses',
            metadata: { characterId },
          }
        );
      }

      logger.info('Fetching character losses from zKillboard', {
        correlationId,
        characterId,
        page,
      });

      // Apply rate limiting with retry
      await this.rateLimiter.wait(signal);

      const response = await this.client.fetch<Record<string, any>>(
        `/losses/characterID/${characterId}/page/${page}/`,
        { signal }
      );

      logger.debug('Raw zKill character losses response received', {
        correlationId,
        characterId,
        page,
        responseType: typeof response,
        hasData: !!response,
      });

      if (!response || typeof response !== 'object') {
        logger.warn('Invalid response format for character losses', {
          correlationId,
          characterId,
          page,
          responseType: typeof response,
        });
        return [];
      }

      // Convert object response to array and validate
      const losses = Object.values(response).filter(kill => {
        const isValid = kill && typeof kill === 'object' && kill.killmail_id && kill.zkb?.hash;

        if (!isValid) {
          logger.debug('Invalid loss entry found', {
            correlationId,
            hasKillmailId: !!kill?.killmail_id,
            hasZkb: !!kill?.zkb,
            hasHash: !!kill?.zkb?.hash,
            keys: kill ? Object.keys(kill) : [],
          });
        }

        return isValid;
      }) as ZkillResponse[];

      logger.info('Successfully fetched and validated character losses', {
        correlationId,
        characterId,
        page,
        validLosses: losses.length,
        totalEntries: Object.keys(response).length,
      });

      return losses;
    } catch (error) {
      throw ExternalServiceError.zkillError(
        error instanceof Error ? error.message : 'Failed to get character losses',
        `/losses/characterID/${characterId}/page/${page}/`,
        undefined,
        {
          correlationId,
          operation: 'getCharacterLosses',
          metadata: { characterId, page },
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
