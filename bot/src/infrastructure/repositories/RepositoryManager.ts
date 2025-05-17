import { CacheAdapter } from "../cache/CacheAdapter";
import { RedisCache } from "../cache/RedisCache";
import { CharacterRepository } from "./CharacterRepository";
import { KillRepository } from "./KillRepository";
import { LossRepository } from "./LossRepository";
import { MapActivityRepository } from "./MapActivityRepository";

/**
 * Manager for repository instances to facilitate dependency injection
 */
export class RepositoryManager {
  // Initialized but not passed to repositories until they are updated to accept it
  private readonly _cache: CacheAdapter;
  private characterRepository?: CharacterRepository;
  private killRepository?: KillRepository;
  private lossRepository?: LossRepository;
  private mapActivityRepository?: MapActivityRepository;

  /**
   * Create a new RepositoryManager
   * @param cache Optional cache adapter to use for all repositories
   */
  constructor(cache?: CacheAdapter) {
    this._cache = cache || new RedisCache();
  }

  /**
   * Get the initialized cache adapter
   */
  get cache(): CacheAdapter {
    return this._cache;
  }

  /**
   * Get the character repository instance
   */
  getCharacterRepository(): CharacterRepository {
    if (!this.characterRepository) {
      this.characterRepository = new CharacterRepository();
    }
    return this.characterRepository;
  }

  /**
   * Get the kill repository instance
   */
  getKillRepository(): KillRepository {
    if (!this.killRepository) {
      this.killRepository = new KillRepository();
    }
    return this.killRepository;
  }

  /**
   * Get the loss repository instance
   */
  getLossRepository(): LossRepository {
    if (!this.lossRepository) {
      this.lossRepository = new LossRepository();
    }
    return this.lossRepository;
  }

  /**
   * Get the map activity repository instance
   */
  getMapActivityRepository(): MapActivityRepository {
    if (!this.mapActivityRepository) {
      this.mapActivityRepository = new MapActivityRepository();
    }
    return this.mapActivityRepository;
  }
}
