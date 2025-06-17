/*
 * WebSocketIngestionService
 * Converted from the browser‑centric `phoenix` client to the Node‑first
 * `phoenix-websocket` implementation.
 *
 * **Key changes**
 * 1. Uses `phoenix-websocket` (async/await API, Node friendly) instead of
 *    the browser Phoenix client.
 * 2. Only a single global WebSocket polyfill is required (`ws`). No more
 *    `location`, `document`, etc.
 * 3. Channels are addressed by topic string – there is no separate
 *    `Channel` object.  We keep a constant `TOPIC` ("killmails:lobby") and
 *    use `subscribeToTopic` / `sendMessage` for all interactions.
 * 4. Built‑in reconnect logic in `phoenix-websocket` replaces the custom
 *    retry loop.  We still track connected state so existing metrics work.
 * 5. Event handlers are supplied when subscribing.
 *
 * Library docs: https://inkarnaterpg.github.io/phoenix-websocket/ ([npmjs.com](https://www.npmjs.com/package/phoenix-websocket))
 */

// Expose a Node WebSocket implementation for phoenix‑websocket.
import { WebSocket } from 'ws';
(global as any).WebSocket ??= WebSocket; // Required in a pure‑Node context ([npmjs.com](https://www.npmjs.com/package/phoenix-websocket))

import { PhoenixWebsocket } from 'phoenix-websocket';

/* eslint-disable max-lines */
import { logger } from '../../lib/logger';
import { CharacterRepository } from '../../infrastructure/repositories/CharacterRepository';
import { KillRepository } from '../../infrastructure/repositories/KillRepository';
import { WebSocketKillmail, WebSocketKillmailUpdate } from '../../types/websocket';
import { WebSocketDataMapper } from './WebSocketDataMapper';
import { PrismaClient } from '@prisma/client';
import { errorHandler, ExternalServiceError, ValidationError } from '../../shared/errors';

interface WebSocketPreloadConfig {
  enabled: boolean;
  limitPerSystem: number;
  sinceHours: number;
  deliveryBatchSize: number;
  deliveryIntervalMs: number;
}

interface WebSocketConfig {
  url: string;
  reconnectIntervalMs?: number; // kept for backwards‑compat, but automatic reconnect is now handled by the lib
  maxReconnectAttempts?: number;
  timeout?: number;
  preload?: WebSocketPreloadConfig;
}

export class WebSocketIngestionService {
  /** Phoenix‑WebSocket client instance */
  private socket: PhoenixWebsocket | null = null;
  /** Constant topic we work with */
  private readonly TOPIC = 'killmails:lobby';

  private characterRepository: CharacterRepository;
  private killRepository: KillRepository;
  private dataMapper: WebSocketDataMapper;
  private config: WebSocketConfig;

  private isRunning = false;
  private connected = false;

  private subscribedCharacters: Set<number> = new Set();
  private subscribedSystems: Set<number> = new Set();
  
  // Size limits to prevent memory exhaustion
  private readonly MAX_SUBSCRIBED_CHARACTERS = 50000;
  private readonly MAX_SUBSCRIBED_SYSTEMS = 10000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig, prisma: PrismaClient) {
    this.config = {
      reconnectIntervalMs: 5_000,
      maxReconnectAttempts: 10,
      timeout: 10_000,
      ...config,
    };

    this.characterRepository = new CharacterRepository(prisma);
    this.killRepository = new KillRepository(prisma);
    this.dataMapper = new WebSocketDataMapper();
  }

  /* ------------------------------------------------------------------
   * Lifecycle
   * ---------------------------------------------------------------- */

  async start(): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();
    
    if (this.isRunning) {
      logger.warn('WebSocket ingestion service is already running', {
        correlationId,
      });
      return;
    }

    this.isRunning = true;
    logger.info('Starting WebSocket ingestion service', {
      correlationId,
      url: this.config.url,
    });
    
    // Start periodic cleanup to prevent unbounded growth
    this.cleanupInterval = setInterval(() => {
      this.cleanupSubscriptions();
    }, 3600000); // Every hour

    try {
      await errorHandler.withRetry(
        async () => {
          await this.connect();
          await this.subscribeToTrackedCharacters();
        },
        3,
        2000,
        {
          correlationId,
          operation: 'websocket.service.start',
          metadata: { url: this.config.url },
        }
      );

      logger.info('WebSocket ingestion service started successfully', {
        correlationId,
      });
    } catch (error) {
      this.isRunning = false;
      throw errorHandler.handleExternalServiceError(
        error,
        'WEBSOCKET',
        'start'
      );
    }
  }

  async stop(): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();
    
    if (!this.isRunning) {
      logger.debug('WebSocket ingestion service is not running', {
        correlationId,
      });
      return;
    }

    logger.info('Stopping WebSocket ingestion service', {
      correlationId,
    });
    
    this.isRunning = false;

    if (this.socket) {
      try {
        this.socket.unsubscribeToTopic(this.TOPIC);
        logger.debug('Unsubscribed from topic', {
          correlationId,
          topic: this.TOPIC,
        });
      } catch (err) {
        logger.debug('Topic unsubscribe threw (ignoring)', {
          correlationId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      
      this.socket.disconnect();
      this.socket = null;
      logger.debug('Disconnected WebSocket', {
        correlationId,
      });
    }

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.connected = false;
    this.subscribedCharacters.clear();
    this.subscribedSystems.clear();
    
    logger.info('WebSocket ingestion service stopped successfully', {
      correlationId,
    });
  }

  /* ------------------------------------------------------------------
   * Connection & topic join
   * ---------------------------------------------------------------- */

  private async connect(): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      // Validate configuration
      if (!this.config.url) {
        throw new ValidationError(
          'Missing required field: config.url',
          [{
            field: 'config.url',
            value: undefined,
            constraint: 'required',
            message: 'config.url is required'
          }],
          {
            correlationId,
            operation: 'websocket.connect',
          }
        );
      }

      logger.info(`Connecting to Phoenix WebSocket at ${this.config.url}`, {
        correlationId,
        url: this.config.url,
        timeout: this.config.timeout,
      });

      this.socket = new PhoenixWebsocket(
        this.config.url, 
        { client_identifier: 'eve-chart-bot' }, 
        this.config.timeout
      );

      // Track connection status for metrics.
      this.socket.onConnectedCallback = () => {
        this.connected = true;
        logger.info('WebSocket connected', {
          correlationId,
        });
      };

      this.socket.onDisconnectedCallback = () => {
        this.connected = false;
        logger.warn('WebSocket disconnected – library will retry automatically', {
          correlationId,
        });
      };

      // Establish the low‑level connection.
      await this.socket.connect();

      // Join the lobby topic & attach broadcast handlers.
      await this.joinLobby();
      
      logger.info('WebSocket connection established successfully', {
        correlationId,
      });
    } catch (error) {
      throw errorHandler.handleExternalServiceError(
        error,
        'WEBSOCKET',
        'connect'
      );
    }
  }

  private async joinLobby(): Promise<void> {
    if (!this.socket) throw new Error('Socket not initialised');

    const preload = this.getPreloadConfig();
    const params = preload ? { preload } : undefined;

    logger.info('Subscribing to lobby topic', { params });

    await this.socket.subscribeToTopic(
      this.TOPIC,
      params,
      {
        killmail_update: async (data?: { [key: string]: any }) => {
          if (!data) return;
          const payload = data as WebSocketKillmailUpdate;
          try {
            logger.info(`Received killmail update for system ${payload.system_id}`, {
              killmailCount: payload.killmails.length,
              preload: payload.preload,
              timestamp: payload.timestamp,
            });

            // Log each individual killmail
            payload.killmails.forEach((killmail, index) => {
              logger.info(`Killmail ${index + 1}/${payload.killmails.length}:`, {
                killmailId: killmail.killmail_id,
                systemId: killmail.system_id,
                killTime: killmail.kill_time,
                victimName: killmail.victim?.character_name ?? 'Unknown',
                victimShip: killmail.victim?.ship_name ?? 'Unknown',
                attackerCount: killmail.attackers?.length ?? 0,
                finalBlowBy: killmail.attackers?.find(a => a.final_blow)?.character_name ?? 'Unknown',
                totalValue: killmail.zkb?.total_value
                  ? `${(killmail.zkb.total_value / 1000000).toFixed(2)}M ISK`
                  : 'Unknown',
              });
            });

            await this.processKillmails(payload.killmails, payload.preload ?? false);
          } catch (err) {
            logger.error('Failed to process killmail update', err);
          }
        },
        kill_count_update: (data?: { [key: string]: any }) => {
          if (!data) return;
          logger.debug(`Kill count update for system ${data.system_id}: ${data.count} kills`);
        },
      },
      // Reconnect handler – ensure character/system subscriptions are replayed
      async (reconnectPromise: Promise<void>) => {
        try {
          await reconnectPromise;
          logger.info('Re‑joined lobby after reconnect – refreshing subscriptions');
          await this.subscribeToTrackedCharacters();
          if (this.subscribedSystems.size) {
            await this.subscribeToSystems(Array.from(this.subscribedSystems));
          }
        } catch (error) {
          logger.error('Failed to re‑join lobby', error);
        }
      }
    );

    logger.info('Joined lobby topic successfully');
  }

  /* ------------------------------------------------------------------
   * Subscription helpers
   * ---------------------------------------------------------------- */

  private async subscribeToTrackedCharacters(): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();
    
    try {
      if (!this.socket) {
        throw new ExternalServiceError(
          'WEBSOCKET',
          'Socket not initialized'
        );
      }

      logger.debug('Getting tracked characters for subscription', {
        correlationId,
      });

      const characters = await errorHandler.withRetry(
        async () => {
          return await this.characterRepository.getAllCharacters();
        },
        3,
        1000,
        {
          correlationId,
          operation: 'websocket.getTrackedCharacters',
        }
      );

      const characterIds = characters.map(c => Number(c.eveId));

      if (characterIds.length === 0) {
        logger.warn('No tracked characters found', {
          correlationId,
        });
        return;
      }

      const preload = this.getPreloadConfig();
      const payload: any = { character_ids: characterIds };
      if (preload) payload.preload = preload;

      logger.info(`Subscribing to ${characterIds.length} characters...`, {
        correlationId,
        characterCount: characterIds.length,
        sampleIds: characterIds.slice(0, 5),
        preloadEnabled: !!preload,
      });

      const startTime = Date.now();
      const response = await errorHandler.withRetry(
        async () => {
          return await this.socket!.sendMessage(this.TOPIC, 'subscribe_characters', payload);
        },
        3,
        2000,
        {
          correlationId,
          operation: 'websocket.subscribeCharacters',
          metadata: { characterCount: characterIds.length },
        }
      );
      
      const duration = Date.now() - startTime;

      characterIds.forEach(id => this.subscribedCharacters.add(id));
      logger.info(
        `Successfully subscribed to ${characterIds.length} characters in ${duration}ms${preload ? ' with preload' : ''}`,
        {
          correlationId,
          response,
          characterIds: characterIds.slice(0, 10), // Log first 10 for debugging
          totalCount: characterIds.length,
          duration,
        }
      );
    } catch (error) {
      throw errorHandler.handleExternalServiceError(
        error,
        'WEBSOCKET',
        'subscribeToTrackedCharacters'
      );
    }
  }

  async updateCharacterSubscriptions(addCharacterIds: number[] = [], removeCharacterIds: number[] = []): Promise<void> {
    if (!this.socket) {
      logger.warn('Socket not initialised – cannot update subscriptions');
      return;
    }

    const preload = this.getPreloadConfig();

    if (addCharacterIds.length) {
      logger.info(`Adding subscription for ${addCharacterIds.length} characters...`);
      const payload: any = { character_ids: addCharacterIds };
      if (preload) payload.preload = preload;
      await this.socket
        .sendMessage(this.TOPIC, 'subscribe_characters', payload)
        .then(() => {
          addCharacterIds.forEach(id => {
            // Check size limit before adding
            if (this.subscribedCharacters.size < this.MAX_SUBSCRIBED_CHARACTERS) {
              this.subscribedCharacters.add(id);
            } else {
              logger.warn(`Reached max subscribed characters limit (${this.MAX_SUBSCRIBED_CHARACTERS}), skipping character ${id}`);
            }
          });
          logger.info(
            `Successfully added subscription for ${addCharacterIds.length} characters${preload ? ' with preload' : ''}`,
            { totalSubscribed: this.subscribedCharacters.size }
          );
        })
        .catch((error: any) => {
          logger.error('Failed to add character subscriptions', error);
          throw error;
        });
    }

    if (removeCharacterIds.length) {
      await this.socket
        .sendMessage(this.TOPIC, 'unsubscribe_characters', {
          character_ids: removeCharacterIds,
        })
        .then(() => {
          removeCharacterIds.forEach(id => this.subscribedCharacters.delete(id));
          logger.info(`Removed subscription for ${removeCharacterIds.length} characters`);
        })
        .catch((error: any) => {
          logger.error('Failed to remove character subscriptions', error);
          throw error;
        });
    }
  }

  async subscribeToSystems(systemIds: number[]): Promise<void> {
    if (!this.socket || systemIds.length === 0) return;

    const preload = this.getPreloadConfig();
    const payload: any = { systems: systemIds };
    if (preload) payload.preload = preload;

    logger.info(`Subscribing to ${systemIds.length} systems...`);

    try {
      await this.socket.sendMessage(this.TOPIC, 'subscribe_systems', payload);
      systemIds.forEach(id => {
        // Check size limit before adding
        if (this.subscribedSystems.size < this.MAX_SUBSCRIBED_SYSTEMS) {
          this.subscribedSystems.add(id);
        } else {
          logger.warn(`Reached max subscribed systems limit (${this.MAX_SUBSCRIBED_SYSTEMS}), skipping system ${id}`);
        }
      });
      logger.info(`Successfully subscribed to ${systemIds.length} systems${preload ? ' with preload' : ''}`, {
        systemIds: systemIds.slice(0, 10), // Log first 10 for debugging
        totalCount: systemIds.length,
      });
    } catch (error) {
      logger.error('Failed to subscribe to systems', error);
      throw error;
    }
  }

  /* ------------------------------------------------------------------
   * Killmail processing
   * ---------------------------------------------------------------- */

  private async processKillmails(killmails: WebSocketKillmail[], isPreload: boolean): Promise<void> {
    for (const killmail of killmails) {
      try {
        const involvedCharacters = this.getInvolvedCharacters(killmail);
        const trackedCharacters = involvedCharacters.filter(id => this.subscribedCharacters.has(id));

        if (trackedCharacters.length === 0 && !this.subscribedSystems.has(killmail.system_id)) {
          continue; // Skip if not relevant
        }

        const killData = this.dataMapper.mapKillmail(killmail);
        await this.killRepository.ingestKillmail(
          killData.killFact,
          killData.victim,
          killData.attackers,
          killData.involvedCharacters
        );

        logger.info(`Ingested killmail ${killmail.killmail_id}`, {
          system: killmail.system_id,
          isPreload,
          trackedCharacters,
        });
      } catch (error) {
        logger.error(`Failed to process killmail ${killmail.killmail_id}`, error);
      }
    }
  }

  private getInvolvedCharacters(killmail: WebSocketKillmail): number[] {
    const characters: number[] = [];

    if (killmail.victim?.character_id) {
      characters.push(killmail.victim.character_id);
    }

    if (killmail.attackers) {
      for (const attacker of killmail.attackers) {
        if (attacker.character_id) {
          characters.push(attacker.character_id);
        }
      }
    }

    return characters;
  }

  /* ------------------------------------------------------------------
   * Utility helpers
   * ---------------------------------------------------------------- */

  private getPreloadConfig() {
    if (!this.config.preload?.enabled) return undefined;

    return {
      enabled: true,
      limit_per_system: this.config.preload.limitPerSystem,
      since_hours: this.config.preload.sinceHours,
      delivery_batch_size: this.config.preload.deliveryBatchSize,
      delivery_interval_ms: this.config.preload.deliveryIntervalMs,
    };
  }

  private cleanupSubscriptions(): void {
    const charCount = this.subscribedCharacters.size;
    const sysCount = this.subscribedSystems.size;
    
    if (charCount > this.MAX_SUBSCRIBED_CHARACTERS * 0.9 || sysCount > this.MAX_SUBSCRIBED_SYSTEMS * 0.9) {
      logger.warn('Subscription sets approaching limits', {
        characters: `${charCount}/${this.MAX_SUBSCRIBED_CHARACTERS}`,
        systems: `${sysCount}/${this.MAX_SUBSCRIBED_SYSTEMS}`,
      });
    }
    
    // Log current sizes for monitoring
    logger.info('WebSocket subscription sizes', {
      subscribedCharacters: charCount,
      subscribedSystems: sysCount,
    });
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isConnected: this.connected,
      subscribedCharacters: this.subscribedCharacters.size,
      subscribedSystems: this.subscribedSystems.size,
      limits: {
        maxCharacters: this.MAX_SUBSCRIBED_CHARACTERS,
        maxSystems: this.MAX_SUBSCRIBED_SYSTEMS,
      },
    };
  }
}
