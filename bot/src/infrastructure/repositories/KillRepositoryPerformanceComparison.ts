import { PrismaClient } from '@prisma/client';
import { KillRepository } from './KillRepository';
import { OptimizedKillRepository } from './OptimizedKillRepository';
import { logger } from '../../lib/logger';

/**
 * Performance metrics for repository operations
 */
interface PerformanceMetrics {
  totalTime: number;
  databaseQueries: number;
  transactionTime: number;
  memoryUsage: number;
}

/**
 * Comparison results between original and optimized repositories
 */
interface ComparisonResult {
  original: PerformanceMetrics;
  optimized: PerformanceMetrics;
  improvement: {
    timeReduction: number; // percentage
    queryReduction: number; // percentage
    memoryReduction: number; // percentage
  };
}

/**
 * Utility for comparing performance between original and optimized KillRepository
 */
export class KillRepositoryPerformanceComparison {
  constructor(private prisma: PrismaClient) {}

  /**
   * Run performance comparison between original and optimized repositories
   */
  async comparePerformance(
    testData: {
      killFact: any;
      victim: any;
      attackers: any[];
      involvedCharacters: any[];
    },
    iterations: number = 100
  ): Promise<ComparisonResult> {
    logger.info(`Starting performance comparison with ${iterations} iterations`);

    // Test original repository
    const originalMetrics = await this.measureRepository(
      new KillRepository(this.prisma),
      testData,
      iterations,
      'original'
    );

    // Test optimized repository  
    const optimizedMetrics = await this.measureRepository(
      new OptimizedKillRepository(this.prisma),
      testData,
      iterations,
      'optimized'
    );

    // Calculate improvements
    const improvement = {
      timeReduction: ((originalMetrics.totalTime - optimizedMetrics.totalTime) / originalMetrics.totalTime) * 100,
      queryReduction: ((originalMetrics.databaseQueries - optimizedMetrics.databaseQueries) / originalMetrics.databaseQueries) * 100,
      memoryReduction: ((originalMetrics.memoryUsage - optimizedMetrics.memoryUsage) / originalMetrics.memoryUsage) * 100,
    };

    const result: ComparisonResult = {
      original: originalMetrics,
      optimized: optimizedMetrics,
      improvement,
    };

    logger.info('Performance comparison completed', {
      timeImprovement: `${improvement.timeReduction.toFixed(2)}%`,
      queryImprovement: `${improvement.queryReduction.toFixed(2)}%`,
      memoryImprovement: `${improvement.memoryReduction.toFixed(2)}%`,
    });

    return result;
  }

  /**
   * Measure performance metrics for a repository implementation
   */
  private async measureRepository(
    repository: KillRepository | OptimizedKillRepository,
    testData: any,
    iterations: number,
    type: 'original' | 'optimized'
  ): Promise<PerformanceMetrics> {
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();
    
    // Track database queries (simplified - in real implementation you'd use Prisma middleware)
    const queryCount = 0;
    // Monkey-patching Prisma methods is not type-safe
    // const originalQuery = this.prisma.$executeRaw;
    // this.prisma.$executeRaw = async (...args) => {
    //   queryCount++;
    //   return originalQuery.apply(this.prisma, args);
    // };

    try {
      // Run multiple iterations to get average performance
      for (let i = 0; i < iterations; i++) {
        // Modify killmail ID for each iteration to avoid conflicts
        const modifiedTestData = {
          ...testData,
          killFact: {
            ...testData.killFact,
            killmail_id: testData.killFact.killmail_id + BigInt(i),
          },
        };

        await repository.ingestKillmail(
          modifiedTestData.killFact,
          modifiedTestData.victim,
          modifiedTestData.attackers,
          modifiedTestData.involvedCharacters
        );

        // Small delay to prevent overwhelming the database
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    } finally {
      // Restore original query method
      // this.prisma.$executeRaw = originalQuery; // Commented out with the monkey-patch
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    const metrics: PerformanceMetrics = {
      totalTime: endTime - startTime,
      databaseQueries: queryCount,
      transactionTime: (endTime - startTime) / iterations, // Average per iteration
      memoryUsage: endMemory - startMemory,
    };

    logger.info(`${type} repository metrics`, {
      totalTime: `${metrics.totalTime.toFixed(2)}ms`,
      avgTimePerIteration: `${metrics.transactionTime.toFixed(2)}ms`,
      totalQueries: metrics.databaseQueries,
      avgQueriesPerIteration: (metrics.databaseQueries / iterations).toFixed(2),
      memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
    });

    return metrics;
  }

  /**
   * Generate test data for performance comparison
   */
  static generateTestData(killmailId: bigint = BigInt(1000000)): {
    killFact: any;
    victim: any;
    attackers: any[];
    involvedCharacters: any[];
  } {
    const attackers = Array.from({ length: 10 }, (_, i) => ({
      character_id: BigInt(2000000 + i),
      corporation_id: BigInt(3000000 + i),
      alliance_id: i % 3 === 0 ? BigInt(4000000 + Math.floor(i / 3)) : undefined,
      damage_done: Math.floor(Math.random() * 1000) + 100,
      final_blow: i === 0,
      security_status: Math.random() * 10 - 5,
      ship_type_id: 588 + i, // Various ship types
      weapon_type_id: 2488 + i, // Various weapon types
    }));

    const victim = {
      character_id: BigInt(5000000),
      corporation_id: BigInt(6000000),
      alliance_id: BigInt(7000000),
      ship_type_id: 670, // Capsule
      damage_taken: 5000,
    };

    const involvedCharacters = [
      ...attackers.map(a => ({
        character_id: a.character_id!,
        role: 'attacker' as const,
      })),
      {
        character_id: victim.character_id!,
        role: 'victim' as const,
      },
    ];

    const killFact = {
      killmail_id: killmailId,
      kill_time: new Date(),
      npc: false,
      solo: attackers.length === 1,
      awox: false,
      ship_type_id: victim.ship_type_id,
      system_id: 30000142, // Jita
      labels: ['pvp', 'highsec'],
      total_value: BigInt(Math.floor(Math.random() * 100000000) + 1000000), // 1M to 100M ISK
      points: Math.floor(Math.random() * 100) + 1,
    };

    return {
      killFact,
      victim,
      attackers,
      involvedCharacters,
    };
  }

  /**
   * Create a detailed performance report
   */
  static formatPerformanceReport(result: ComparisonResult): string {
    return `
# Kill Repository Performance Comparison Report

## Original Repository Metrics
- Total Time: ${result.original.totalTime.toFixed(2)}ms
- Database Queries: ${result.original.databaseQueries}
- Avg Transaction Time: ${result.original.transactionTime.toFixed(2)}ms
- Memory Usage: ${(result.original.memoryUsage / 1024 / 1024).toFixed(2)}MB

## Optimized Repository Metrics
- Total Time: ${result.optimized.totalTime.toFixed(2)}ms
- Database Queries: ${result.optimized.databaseQueries}
- Avg Transaction Time: ${result.optimized.transactionTime.toFixed(2)}ms
- Memory Usage: ${(result.optimized.memoryUsage / 1024 / 1024).toFixed(2)}MB

## Performance Improvements
- ⚡ Time Reduction: ${result.improvement.timeReduction.toFixed(2)}%
- 🗄️ Query Reduction: ${result.improvement.queryReduction.toFixed(2)}%
- 💾 Memory Reduction: ${result.improvement.memoryReduction.toFixed(2)}%

## Key Optimizations Applied
1. **Upsert Operations**: Replaced delete/insert cycles with single upsert operations
2. **Diff-based Updates**: Only modify records that have actually changed
3. **Batch Operations**: Use createMany with skipDuplicates for bulk operations
4. **Single Query Lookups**: Reduced database round trips for relationship checks
5. **Transaction Optimization**: Fewer operations per transaction, better performance
    `;
  }
}