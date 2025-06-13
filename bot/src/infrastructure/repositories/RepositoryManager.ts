import { CharacterRepository } from "./CharacterRepository";
import { KillRepository } from "./KillRepository";
import { LossRepository } from "./LossRepository";
import { MapActivityRepository } from "./MapActivityRepository";
import { PrismaClient } from "@prisma/client";

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
    return this.characterRepository!;
  }

  /**
   * Get the kill repository instance
   */
  getKillRepository(): KillRepository {
    return this.killRepository!;
  }

  /**
   * Get the loss repository instance
   */
  getLossRepository(): LossRepository {
    return this.lossRepository!;
  }

  /**
   * Get the map activity repository instance
   */
  getMapActivityRepository(): MapActivityRepository {
    return this.mapActivityRepository!;
  }
}
