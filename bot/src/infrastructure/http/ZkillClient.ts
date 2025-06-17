import { TypeSafeHttpClient } from '../../shared/http/TypeSafeHttpClient';
import { ZkillResponseSchema, ZkillResponse } from '../../shared/schemas/api-responses';
import { logger } from '../../lib/logger';
import { RateLimiter } from '../../shared/performance/rateLimiter';
import { rateLimiterManager } from '../../shared/performance/RateLimiterManager';
import { ValidatedConfiguration } from '../../config/validated';
import { ExternalServiceError, ValidationError } from '../../shared/errors';
import * as crypto from 'crypto';
import { z } from 'zod';

export class ZkillClient {
  private readonly client: TypeSafeHttpClient;
  private readonly rateLimiter: RateLimiter;

  constructor(baseUrl: string = 'https://zkillboard.com/api') {
    this.client = new TypeSafeHttpClient({
      baseURL: baseUrl,
      timeout: 15000,
      retries: 3,
      headers: {
        'User-Agent': 'EVE-Chart-Bot/1.0',
      },
    });

    // Use shared rate limiter from singleton manager
    // Override the default delay with config value if needed
    this.rateLimiter = rateLimiterManager.getRateLimiter('zKillboard', {
      minDelayMs: ValidatedConfiguration.rateLimit.minDelay,
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
        throw ValidationError.invalidFormat('killId', 'positive integer', killId.toString(), {
          correlationId,
          operation: 'zkill.getKillmail',
        });
      }

      logger.info('Fetching killmail from zKillboard', {
        correlationId,
        killId,
      });

      // Apply rate limiting with retry
      await this.rateLimiter.wait(signal);

      // The zKillboard API returns either an array or an object with killID as key
      const response = await this.client.getRaw(`/killID/${killId}/`, { signal });

      logger.debug('Raw zKill response received', {
        correlationId,
        killId,
        responseType: typeof response,
        hasData: !!response,
      });

      // Handle different response formats from zKillboard
      let killData: unknown;

      if (Array.isArray(response)) {
        killData = response[0]; // First element in array
      } else if (response && typeof response === 'object') {
        // Response might be wrapped in an object with killID as key
        const responseObj = response as Record<string, unknown>;
        killData = responseObj[killId.toString()] || response;
      } else {
        logger.warn('Invalid response format from zKillboard', {
          correlationId,
          killId,
          responseType: typeof response,
        });
        return null;
      }

      if (!killData) {
        logger.warn('No kill data found in response', {
          correlationId,
          killId,
        });
        return null;
      }

      // Validate the kill data with Zod schema
      const validatedKill = ZkillResponseSchema.parse(killData);

      logger.debug('Kill data validated successfully', {
        correlationId,
        killId,
        killmailId: validatedKill.killmail_id,
        hasZkb: !!validatedKill.zkb,
        totalValue: validatedKill.zkb.totalValue,
      });

      // Ensure the killID matches (if present)
      if (validatedKill.killID && validatedKill.killID !== killId) {
        throw ValidationError.invalidFormat('killID', killId.toString(), validatedKill.killID.toString(), {
          correlationId,
          operation: 'zkill.validate.killIdMatch',
          metadata: { expectedKillId: killId, actualKillId: validatedKill.killID },
        });
      }

      logger.debug('Successfully validated killmail data', {
        correlationId,
        killId,
        killmailId: validatedKill.killmail_id,
        hash: validatedKill.zkb.hash,
      });

      return validatedKill;
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
        throw ValidationError.invalidFormat('characterId', 'positive integer', characterId.toString(), {
          correlationId,
          operation: 'zkill.getCharacterKills',
          metadata: { page },
        });
      }

      if (page <= 0) {
        throw ValidationError.outOfRange('page', 1, Number.MAX_SAFE_INTEGER, page.toString(), {
          correlationId,
          operation: 'zkill.getCharacterKills',
          metadata: { characterId },
        });
      }

      logger.info('Fetching character kills from zKillboard', {
        correlationId,
        characterId,
        page,
      });

      // Apply rate limiting with retry
      await this.rateLimiter.wait(signal);

      const response = await this.client.get(
        `/characterID/${characterId}/page/${page}/`,
        z.record(z.any()),
        undefined,
        { signal }
      );

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
      const kills = Object.values(response).filter((kill: any) => {
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
        throw ValidationError.invalidFormat('characterId', 'positive integer', characterId.toString(), {
          correlationId,
          operation: 'zkill.getCharacterLosses',
          metadata: { page },
        });
      }

      if (page <= 0) {
        throw ValidationError.outOfRange('page', 1, Number.MAX_SAFE_INTEGER, page.toString(), {
          correlationId,
          operation: 'zkill.getCharacterLosses',
          metadata: { characterId },
        });
      }

      logger.info('Fetching character losses from zKillboard', {
        correlationId,
        characterId,
        page,
      });

      // Apply rate limiting with retry
      await this.rateLimiter.wait(signal);

      const response = await this.client.get(
        `/losses/characterID/${characterId}/page/${page}/`,
        z.record(z.any()),
        undefined,
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
      const losses = Object.values(response).filter((kill: any) => {
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
