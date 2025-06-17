import { logger } from '../lib/logger';
import { timerManager } from '../shared/performance/timerManager';

export class MemoryMonitor {
  private interval: ReturnType<typeof setInterval> | null = null;
  private samples: { timestamp: Date; memory: NodeJS.MemoryUsage }[] = [];
  private maxSamples = 100;

  start(intervalMs = 60000): void {
    if (this.interval) {
      logger.warn('Memory monitor already running');
      return;
    }

    logger.info('Starting memory monitor');
    
    // Take initial sample
    this.takeSample();

    this.interval = timerManager.setInterval(() => {
      this.takeSample();
    }, intervalMs);
  }

  stop(): void {
    if (this.interval) {
      timerManager.clearInterval(this.interval);
      this.interval = null;
      logger.info('Memory monitor stopped');
      this.logSummary();
    }
  }

  private takeSample(): void {
    const memory = process.memoryUsage();
    const v8 = require('v8');
    const heapStats = v8.getHeapStatistics();
    const sample = {
      timestamp: new Date(),
      memory
    };

    this.samples.push(sample);
    
    // Keep only recent samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    // Calculate heap percentages
    const allocatedPercent = (memory.heapUsed / memory.heapTotal) * 100;
    const actualPercent = (memory.heapUsed / heapStats.heap_size_limit) * 100;

    // Log current usage
    logger.info(`Memory usage: heapUsed=${Math.round(memory.heapUsed / 1024 / 1024)}MB heapTotal=${Math.round(memory.heapTotal / 1024 / 1024)}MB (${allocatedPercent.toFixed(1)}%) actualUsage=${actualPercent.toFixed(1)}% of ${Math.round(heapStats.heap_size_limit / 1024 / 1024)}MB limit rss=${Math.round(memory.rss / 1024 / 1024)}MB`);

    // Only warn if we're using a significant portion of the actual heap limit
    if (actualPercent > 75) {
      logger.warn(`High heap usage: ${actualPercent.toFixed(1)}% of ${Math.round(heapStats.heap_size_limit / 1024 / 1024)}MB limit`);
    }
  }

  private logSummary(): void {
    if (this.samples.length < 2) return;

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    
    const heapGrowth = last.memory.heapUsed - first.memory.heapUsed;
    const timeElapsed = last.timestamp.getTime() - first.timestamp.getTime();
    const growthRate = (heapGrowth / timeElapsed) * 1000 * 60; // MB per minute

    logger.info('Memory monitor summary', {
      duration: `${Math.round(timeElapsed / 1000)}s`,
      heapGrowth: `${Math.round(heapGrowth / 1024 / 1024)}MB`,
      growthRate: `${growthRate.toFixed(2)}MB/min`,
      samples: this.samples.length
    });
  }

  getMetrics() {
    return {
      current: process.memoryUsage(),
      samples: this.samples,
      heapGrowthRate: this.calculateGrowthRate()
    };
  }

  private calculateGrowthRate(): number {
    if (this.samples.length < 2) return 0;
    
    const recentSamples = this.samples.slice(-10); // Last 10 samples
    if (recentSamples.length < 2) return 0;

    const first = recentSamples[0];
    const last = recentSamples[recentSamples.length - 1];
    const heapGrowth = last.memory.heapUsed - first.memory.heapUsed;
    const timeElapsed = last.timestamp.getTime() - first.timestamp.getTime();
    
    return (heapGrowth / timeElapsed) * 1000 * 60; // MB per minute
  }
}

// Global instance
export const memoryMonitor = new MemoryMonitor();