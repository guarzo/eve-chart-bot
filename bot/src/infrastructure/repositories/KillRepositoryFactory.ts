import { PrismaClient } from '@prisma/client';
import { KillRepository } from './KillRepository';
import { OptimizedKillRepository } from './OptimizedKillRepository';
import { logger } from '../../lib/logger';

/**
 * Repository implementation type
 */
export type KillRepositoryImplementation = 'original' | 'optimized';

/**
 * Interface that both repository implementations must satisfy
 */
export interface IKillRepository {
  ingestKillmail(
    killFact: any,
    victim: any,
    attackers: any[],
    involvedCharacters: any[]
  ): Promise<void>;
  
  getTopShipTypesUsed(
    characterIds: bigint[], 
    startDate: Date, 
    endDate: Date, 
    limit: number
  ): Promise<Array<{ shipTypeId: number; count: number }>>;

  getTopShipTypesDestroyed(
    characterIds: bigint[],
    startDate: Date,
    endDate: Date,
    limit: number
  ): Promise<Array<{ shipTypeId: number; count: number }>>;

  getKillsGroupedByTime(
    characterIds: bigint[],
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'day' | 'week'
  ): Promise<Array<{ time: Date; count: number }>>;
}

/**
 * Factory for creating kill repository instances
 * Enables easy switching between original and optimized implementations
 */
export class KillRepositoryFactory {
  /**
   * Create a kill repository instance based on configuration
   */
  static create(
    prisma: PrismaClient,
    implementation?: KillRepositoryImplementation
  ): IKillRepository {
    const useOptimized = implementation === 'optimized' || 
                        process.env.USE_OPTIMIZED_KILL_REPOSITORY === 'true';

    if (useOptimized) {
      logger.info('KillRepositoryFactory: Creating optimized repository');
      return new OptimizedKillRepository(prisma);
    } else {
      logger.info('KillRepositoryFactory: Creating original repository');
      return new KillRepository(prisma) as IKillRepository;
    }
  }

  /**
   * Create repository from environment configuration
   */
  static createFromEnvironment(prisma: PrismaClient): IKillRepository {
    const implementation = process.env.KILL_REPOSITORY_IMPLEMENTATION as KillRepositoryImplementation;
    return this.create(prisma, implementation);
  }

  /**
   * Create both implementations for comparison
   */
  static createBoth(prisma: PrismaClient): {
    original: IKillRepository;
    optimized: IKillRepository;
  } {
    return {
      original: new KillRepository(prisma) as IKillRepository,
      optimized: new OptimizedKillRepository(prisma),
    };
  }

  /**
   * Get the recommended implementation based on system characteristics
   */
  static getRecommendedImplementation(): KillRepositoryImplementation {
    // Check system characteristics to recommend implementation
    const nodeVersion = process.version;
    const memoryLimit = process.env.NODE_OPTIONS?.includes('--max-old-space-size');
    
    // For production environments with high throughput, recommend optimized
    if (process.env.NODE_ENV === 'production') {
      logger.info('KillRepositoryFactory: Recommending optimized implementation for production');
      return 'optimized';
    }

    // For development, use original for stability unless explicitly requested
    if (process.env.NODE_ENV === 'development' && !process.env.USE_OPTIMIZED_KILL_REPOSITORY) {
      logger.info('KillRepositoryFactory: Recommending original implementation for development');
      return 'original';
    }

    // Default to optimized for better performance
    logger.info('KillRepositoryFactory: Recommending optimized implementation as default');
    return 'optimized';
  }

  /**
   * Validate that the repository implementation is working correctly
   */
  static async validateImplementation(
    repository: IKillRepository,
    implementation: KillRepositoryImplementation
  ): Promise<boolean> {
    try {
      logger.info(`KillRepositoryFactory: Validating ${implementation} implementation`);
      
      // Create test data
      const testData = {
        killFact: {
          killmail_id: BigInt(999999999),
          kill_time: new Date(),
          npc: false,
          solo: true,
          awox: false,
          ship_type_id: 588,
          system_id: 30000142,
          labels: ['test'],
          total_value: BigInt(1000000),
          points: 1,
        },
        victim: {
          character_id: BigInt(999999991),
          corporation_id: BigInt(999999992),
          ship_type_id: 588,
          damage_taken: 100,
        },
        attackers: [{
          character_id: BigInt(999999993),
          corporation_id: BigInt(999999994),
          damage_done: 100,
          final_blow: true,
        }],
        involvedCharacters: [
          { character_id: BigInt(999999991), role: 'victim' as const },
          { character_id: BigInt(999999993), role: 'attacker' as const },
        ],
      };

      // Test ingestion
      await repository.ingestKillmail(
        testData.killFact,
        testData.victim,
        testData.attackers,
        testData.involvedCharacters
      );

      logger.info(`KillRepositoryFactory: ${implementation} implementation validation successful`);
      return true;
    } catch (error) {
      logger.error(`KillRepositoryFactory: ${implementation} implementation validation failed`, error);
      return false;
    }
  }

  /**
   * Get configuration info for debugging
   */
  static getConfigurationInfo(): {
    currentImplementation: KillRepositoryImplementation;
    recommendedImplementation: KillRepositoryImplementation;
    environmentOverride: string | undefined;
    productionReady: boolean;
  } {
    const envImplementation = process.env.KILL_REPOSITORY_IMPLEMENTATION as KillRepositoryImplementation;
    const envOptimized = process.env.USE_OPTIMIZED_KILL_REPOSITORY === 'true';
    const recommended = this.getRecommendedImplementation();
    
    const current: KillRepositoryImplementation = 
      envImplementation || (envOptimized ? 'optimized' : recommended);

    return {
      currentImplementation: current,
      recommendedImplementation: recommended,
      environmentOverride: envImplementation || (envOptimized ? 'optimized' : undefined),
      productionReady: current === 'optimized',
    };
  }
}