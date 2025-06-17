import { CharacterRepository } from './CharacterRepository';
import { KillRepository } from './KillRepository';
import { LossRepository } from './LossRepository';
import { MapActivityRepository } from './MapActivityRepository';
import { PrismaClient } from '@prisma/client';
import { DatabaseError } from '../../shared/errors';
import { logger } from '../../lib/logger';

/**
 * Manager for repository instances to facilitate dependency injection
 * Implemented as a singleton to prevent multiple PrismaClient instances
 */
export class RepositoryManager {
  private static instance: RepositoryManager | null = null;

  private characterRepository?: CharacterRepository;
  private killRepository?: KillRepository;
  private lossRepository?: LossRepository;
  private mapActivityRepository?: MapActivityRepository;

  private prisma: PrismaClient;

  /**
   * Create a new RepositoryManager (private constructor for singleton)
   */
  private constructor(prisma?: PrismaClient) {
    try {
      // Use provided PrismaClient or create new one
      this.prisma = prisma || new PrismaClient();
      // Initialize repositories with PrismaClient
      this.characterRepository = new CharacterRepository(this.prisma);
      this.killRepository = new KillRepository(this.prisma);
      this.lossRepository = new LossRepository(this.prisma);
      this.mapActivityRepository = new MapActivityRepository(this.prisma);

      logger.info('RepositoryManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RepositoryManager', error);
      throw DatabaseError.connectionFailed(
        {
          operation: 'initialize_repository_manager',
          metadata: { error: error instanceof Error ? error.message : String(error) },
        },
        error as Error
      );
    }
  }

  /**
   * Get the singleton instance of RepositoryManager
   * @param prisma Optional PrismaClient instance (only used on first call)
   */
  static getInstance(prisma?: PrismaClient): RepositoryManager {
    if (!RepositoryManager.instance) {
      RepositoryManager.instance = new RepositoryManager(prisma);
    }
    return RepositoryManager.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static async resetInstance(): Promise<void> {
    if (this.instance) {
      await this.instance.cleanup();
      this.instance = null;
    }
  }

  /**
   * Get the character repository instance
   */
  getCharacterRepository(): CharacterRepository {
    if (!this.characterRepository) {
      throw DatabaseError.connectionFailed({
        operation: 'get_character_repository',
        metadata: { repository: 'CharacterRepository' },
      });
    }
    return this.characterRepository;
  }

  /**
   * Get the kill repository instance
   */
  getKillRepository(): KillRepository {
    if (!this.killRepository) {
      throw DatabaseError.connectionFailed({
        operation: 'get_kill_repository',
        metadata: { repository: 'KillRepository' },
      });
    }
    return this.killRepository;
  }

  /**
   * Get the loss repository instance
   */
  getLossRepository(): LossRepository {
    if (!this.lossRepository) {
      throw DatabaseError.connectionFailed({
        operation: 'get_loss_repository',
        metadata: { repository: 'LossRepository' },
      });
    }
    return this.lossRepository;
  }

  /**
   * Get the map activity repository instance
   */
  getMapActivityRepository(): MapActivityRepository {
    if (!this.mapActivityRepository) {
      throw DatabaseError.connectionFailed({
        operation: 'get_map_activity_repository',
        metadata: { repository: 'MapActivityRepository' },
      });
    }
    return this.mapActivityRepository;
  }

  /**
   * Cleanup method to properly close database connections
   */
  async cleanup(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('RepositoryManager cleanup completed successfully');
    } catch (error) {
      logger.error('Error during RepositoryManager cleanup', error);
      throw DatabaseError.connectionFailed(
        {
          operation: 'cleanup_repository_manager',
          metadata: { error: error instanceof Error ? error.message : String(error) },
        },
        error as Error
      );
    }
  }

  /**
   * Get the PrismaClient instance (for use in services that need direct access)
   */
  getPrismaClient(): PrismaClient {
    return this.prisma;
  }
}
