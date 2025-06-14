import { logger } from '../lib/logger';

/**
 * Global timer management for proper cleanup on process termination
 */
export class TimerManager {
  private static instance: TimerManager;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly intervals = new Set<ReturnType<typeof setInterval>>();
  private readonly abortControllers = new Set<AbortController>();
  private isShuttingDown = false;

  private constructor() {
    // Register cleanup handlers
    process.once('SIGTERM', () => this.shutdown('SIGTERM'));
    process.once('SIGINT', () => this.shutdown('SIGINT'));
    process.once('beforeExit', () => this.shutdown('beforeExit'));
  }

  static getInstance(): TimerManager {
    if (!TimerManager.instance) {
      TimerManager.instance = new TimerManager();
    }
    return TimerManager.instance;
  }

  /**
   * Create a managed setTimeout that will be cleaned up on shutdown
   */
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    if (this.isShuttingDown) {
      throw new Error('Cannot create timer during shutdown');
    }

    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);

    this.timers.add(timer);
    return timer;
  }

  /**
   * Create a managed setInterval that will be cleaned up on shutdown
   */
  setInterval(callback: () => void, delay: number): ReturnType<typeof setInterval> {
    if (this.isShuttingDown) {
      throw new Error('Cannot create interval during shutdown');
    }

    const interval = setInterval(callback, delay);
    this.intervals.add(interval);
    return interval;
  }

  /**
   * Clear a managed timeout
   */
  clearTimeout(timer: ReturnType<typeof setTimeout>): void {
    clearTimeout(timer);
    this.timers.delete(timer);
  }

  /**
   * Clear a managed interval
   */
  clearInterval(interval: ReturnType<typeof setInterval>): void {
    clearInterval(interval);
    this.intervals.delete(interval);
  }

  /**
   * Create a managed AbortController that will be aborted on shutdown
   */
  createAbortController(): AbortController {
    if (this.isShuttingDown) {
      const controller = new AbortController();
      controller.abort('System is shutting down');
      return controller;
    }

    const controller = new AbortController();
    this.abortControllers.add(controller);
    return controller;
  }

  /**
   * Remove an AbortController from management (e.g., when operation completes)
   */
  removeAbortController(controller: AbortController): void {
    this.abortControllers.delete(controller);
  }

  /**
   * Create a delay promise with automatic cleanup
   */
  async delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timer) {
          this.clearTimeout(timer);
        }
        signal?.removeEventListener('abort', abortHandler);
      };

      const abortHandler = () => {
        cleanup();
        reject(new Error('Delay aborted'));
      };

      if (signal) {
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      timer = this.setTimeout(() => {
        cleanup();
        resolve();
      }, ms);
    });
  }

  /**
   * Shutdown all managed resources
   */
  private shutdown(signal: string): void {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info(`TimerManager: Cleaning up resources on ${signal}`);

    // Clear all timers
    logger.info(`TimerManager: Clearing ${this.timers.size} active timers`);
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    // Clear all intervals
    logger.info(`TimerManager: Clearing ${this.intervals.size} active intervals`);
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();

    // Abort all controllers
    logger.info(`TimerManager: Aborting ${this.abortControllers.size} active operations`);
    this.abortControllers.forEach(controller => {
      if (!controller.signal.aborted) {
        controller.abort('System shutdown');
      }
    });
    this.abortControllers.clear();

    logger.info('TimerManager: Cleanup complete');
  }

  /**
   * Get statistics about managed resources
   */
  getStats(): { timers: number; intervals: number; abortControllers: number } {
    return {
      timers: this.timers.size,
      intervals: this.intervals.size,
      abortControllers: this.abortControllers.size,
    };
  }
}

// Export singleton instance
export const timerManager = TimerManager.getInstance();
