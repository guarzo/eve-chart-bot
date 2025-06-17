import { logger } from '../lib/logger';

export class StartupProfiler {
  private checkpoints: { name: string; memory: NodeJS.MemoryUsage; timestamp: number }[] = [];
  private startTime: number;
  private startMemory: NodeJS.MemoryUsage;

  constructor() {
    this.startTime = Date.now();
    this.startMemory = process.memoryUsage();
    this.checkpoint('Initial');
  }

  checkpoint(name: string): void {
    const memory = process.memoryUsage();
    const timestamp = Date.now();
    
    this.checkpoints.push({ name, memory, timestamp });
    
    const heapDelta = memory.heapUsed - this.startMemory.heapUsed;
    const timeDelta = timestamp - this.startTime;
    
    logger.info(`Startup checkpoint: ${name}`, {
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      heapDelta: `+${Math.round(heapDelta / 1024 / 1024)}MB`,
      heapPercent: `${((memory.heapUsed / memory.heapTotal) * 100).toFixed(1)}%`,
      time: `${timeDelta}ms`
    });
  }

  getReport(): any {
    const report = {
      totalTime: Date.now() - this.startTime,
      totalHeapGrowth: process.memoryUsage().heapUsed - this.startMemory.heapUsed,
      checkpoints: this.checkpoints.map((cp, i) => {
        const heapDelta = i === 0 ? 0 : cp.memory.heapUsed - this.checkpoints[i - 1].memory.heapUsed;
        const timeDelta = i === 0 ? 0 : cp.timestamp - this.checkpoints[i - 1].timestamp;
        
        return {
          name: cp.name,
          heapUsed: Math.round(cp.memory.heapUsed / 1024 / 1024),
          heapDelta: Math.round(heapDelta / 1024 / 1024),
          timeDelta,
          heapPercent: ((cp.memory.heapUsed / cp.memory.heapTotal) * 100).toFixed(1)
        };
      })
    };

    logger.info('Startup profiling report', report);
    return report;
  }
}

// Export singleton instance
export const startupProfiler = new StartupProfiler();