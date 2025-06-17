import axios from 'axios';
import { logger } from './logger';

interface ESIKillmail {
  killmail_id: number;
  killmail_time: string;
  solar_system_id: number;
  victim: {
    character_id?: number;
    corporation_id?: number;
    alliance_id?: number;
    ship_type_id: number;
    damage_taken: number;
    position: { x: number; y: number; z: number };
    items: Array<{
      type_id: number;
      flag: number;
      quantity_destroyed?: number;
      quantity_dropped?: number;
      singleton: number;
    }>;
  };
  attackers: Array<{
    character_id?: number;
    corporation_id?: number;
    alliance_id?: number;
    damage_done: number;
    final_blow: boolean;
    security_status: number;
    ship_type_id: number;
    weapon_type_id: number;
  }>;
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(url: string, retryCount = 0, delay = INITIAL_RETRY_DELAY): Promise<T> {
  try {
    const response = await axios.get<T>(url);
    return response.data;
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      throw error;
    }

    // Check if we should retry based on error type
    const shouldRetry =
      error instanceof Error &&
      (error.message.includes('429') || // Rate limit
        error.message.includes('503') || // Service unavailable
        error.message.includes('504') || // Gateway timeout
        error.message.includes('ECONNRESET') || // Connection reset
        error.message.includes('ETIMEDOUT')); // Connection timeout

    if (!shouldRetry) {
      throw error;
    }

    // Calculate exponential backoff delay
    const nextDelay = delay * Math.pow(2, retryCount);
    logger.warn('ESI request failed, retrying...', {
      url,
      retryCount: retryCount + 1,
      nextDelay,
      error: error instanceof Error ? error.message : error,
    });

    await sleep(nextDelay);
    return fetchWithRetry<T>(url, retryCount + 1, nextDelay);
  }
}

export async function fetchESIKillmail(killId: number, hash: string, retryCount = 0): Promise<ESIKillmail> {
  try {
    // In test environment, return mock data
    if (process.env.NODE_ENV === 'test') {
      return {
        killmail_id: killId,
        killmail_time: new Date().toISOString(),
        solar_system_id: 30000142,
        victim: {
          character_id: 123456,
          corporation_id: 98765,
          alliance_id: 54321,
          ship_type_id: 670,
          damage_taken: 100,
          position: { x: 0, y: 0, z: 0 },
          items: [],
        },
        attackers: [
          {
            character_id: 987654,
            corporation_id: 56789,
            alliance_id: 12345,
            damage_done: 100,
            final_blow: true,
            security_status: 0,
            ship_type_id: 603,
            weapon_type_id: 587,
          },
        ],
      };
    }

    const url = `https://esi.evetech.net/latest/killmails/${killId}/${hash}/?datasource=tranquility`;
    return await fetchWithRetry<ESIKillmail>(url);
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      logger.error(
        {
          error,
          killId,
          hash,
          retryCount,
          errorMessage: error instanceof Error ? error.message : error,
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        'Max retries reached for ESI fetch'
      );
      throw error;
    }

    // Calculate exponential backoff delay
    const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
    logger.warn(
      {
        error,
        killId,
        hash,
        retryCount: retryCount + 1,
        delay,
        errorMessage: error instanceof Error ? error.message : error,
      },
      'Error fetching ESI data, retrying...'
    );

    await sleep(delay);
    return fetchESIKillmail(killId, hash, retryCount + 1);
  }
}
