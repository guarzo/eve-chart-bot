import { CharacterRepository } from './CharacterRepository';
import { KillRepository } from './KillRepository';
import { LossRepository } from './LossRepository';
import { MapActivityRepository } from './MapActivityRepository';
import { PrismaClient } from '@prisma/client';

/**
 * Manager for repository instances to facilitate dependency injection
 */
export class RepositoryManager {
  private characterRepository?: CharacterRepository;
  private killRepository?: KillRepository;
  private lossRepository?: LossRepository;
  private mapActivityRepository?: MapActivityRepository;

  private prisma: PrismaClient;

  /**
   * Create a new RepositoryManager
   */
  constructor() {
    this.prisma = new PrismaClient();
    // Initialize repositories with PrismaClient
    this.characterRepository = new CharacterRepository(this.prisma);
    this.killRepository = new KillRepository(this.prisma);
    this.lossRepository = new LossRepository();
    this.mapActivityRepository = new MapActivityRepository();
  }

  /**
   * Get the character repository instance
   */
  getCharacterRepository(): CharacterRepository {
    if (!this.characterRepository) {
      throw new Error('CharacterRepository not initialized');
    }
    return this.characterRepository;
  }

  /**
   * Get the kill repository instance
   */
  getKillRepository(): KillRepository {
    if (!this.killRepository) {
      throw new Error('KillRepository not initialized');
    }
    return this.killRepository;
  }

  /**
   * Get the loss repository instance
   */
  getLossRepository(): LossRepository {
    if (!this.lossRepository) {
      throw new Error('LossRepository not initialized');
    }
    return this.lossRepository;
  }

  /**
   * Get the map activity repository instance
   */
  getMapActivityRepository(): MapActivityRepository {
    if (!this.mapActivityRepository) {
      throw new Error('MapActivityRepository not initialized');
    }
    return this.mapActivityRepository;
  }
}
