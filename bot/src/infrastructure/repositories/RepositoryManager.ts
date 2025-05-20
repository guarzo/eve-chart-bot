import { CharacterRepository } from "./CharacterRepository";
import { KillRepository } from "./KillRepository";
import { LossRepository } from "./LossRepository";
import { MapActivityRepository } from "./MapActivityRepository";

/**
 * Manager for repository instances to facilitate dependency injection
 */
export class RepositoryManager {
  private characterRepository?: CharacterRepository;
  private killRepository?: KillRepository;
  private lossRepository?: LossRepository;
  private mapActivityRepository?: MapActivityRepository;

  /**
   * Create a new RepositoryManager
   */
  constructor() {
    // Initialize repositories with their model names
    this.characterRepository = new CharacterRepository();
    this.killRepository = new KillRepository();
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
