import { TimerManager } from "../../../src/utils/timerManager";

describe("TimerManager", () => {
  let timerManager: TimerManager;

  beforeEach(() => {
    // Get a fresh instance for each test
    timerManager = TimerManager.getInstance();
  });

  afterEach(() => {
    // Clean up any active timers
    jest.clearAllTimers();
  });

  describe("setTimeout", () => {
    it("should execute callback after delay", async () => {
      const callback = jest.fn();
      
      timerManager.setTimeout(callback, 100);
      
      expect(callback).not.toHaveBeenCalled();
      
      // Wait for the timer to execute
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should clean up timer after execution", async () => {
      const callback = jest.fn();
      const stats = timerManager.getStats();
      const initialTimerCount = stats.timers;
      
      timerManager.setTimeout(callback, 100);
      
      // Should have one more timer
      expect(timerManager.getStats().timers).toBe(initialTimerCount + 1);
      
      // Wait for timer to execute
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Timer should be removed after execution
      expect(timerManager.getStats().timers).toBe(initialTimerCount);
    });

    it("should allow clearing timeout", () => {
      const callback = jest.fn();
      const timer = timerManager.setTimeout(callback, 1000);
      
      timerManager.clearTimeout(timer);
      
      // Wait to ensure callback is not called
      jest.advanceTimersByTime(1500);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("setInterval", () => {
    it("should execute callback repeatedly", async () => {
      const callback = jest.fn();
      
      const interval = timerManager.setInterval(callback, 100);
      
      // Wait for multiple executions
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(callback).toHaveBeenCalledTimes(3);
      
      timerManager.clearInterval(interval);
    });

    it("should track active intervals", () => {
      const callback = jest.fn();
      const stats = timerManager.getStats();
      const initialIntervalCount = stats.intervals;
      
      const interval1 = timerManager.setInterval(callback, 100);
      const interval2 = timerManager.setInterval(callback, 200);
      
      expect(timerManager.getStats().intervals).toBe(initialIntervalCount + 2);
      
      timerManager.clearInterval(interval1);
      expect(timerManager.getStats().intervals).toBe(initialIntervalCount + 1);
      
      timerManager.clearInterval(interval2);
      expect(timerManager.getStats().intervals).toBe(initialIntervalCount);
    });
  });

  describe("AbortController management", () => {
    it("should create and track abort controllers", () => {
      const stats = timerManager.getStats();
      const initialControllerCount = stats.abortControllers;
      
      const controller1 = timerManager.createAbortController();
      const controller2 = timerManager.createAbortController();
      
      expect(timerManager.getStats().abortControllers).toBe(initialControllerCount + 2);
      
      timerManager.removeAbortController(controller1);
      expect(timerManager.getStats().abortControllers).toBe(initialControllerCount + 1);
      
      timerManager.removeAbortController(controller2);
      expect(timerManager.getStats().abortControllers).toBe(initialControllerCount);
    });
  });

  describe("delay", () => {
    it("should resolve after specified delay", async () => {
      const start = Date.now();
      
      await timerManager.delay(100);
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(95); // Allow small timing variance
      expect(elapsed).toBeLessThan(150);
    });

    it("should reject when aborted", async () => {
      const controller = new AbortController();
      
      const delayPromise = timerManager.delay(1000, controller.signal);
      
      // Abort after 50ms
      setTimeout(() => controller.abort(), 50);
      
      await expect(delayPromise).rejects.toThrow("Delay aborted");
    });

    it("should clean up timer when aborted", async () => {
      const controller = new AbortController();
      const stats = timerManager.getStats();
      const initialTimerCount = stats.timers;
      
      const delayPromise = timerManager.delay(1000, controller.signal);
      
      // Should have one more timer
      expect(timerManager.getStats().timers).toBe(initialTimerCount + 1);
      
      controller.abort();
      
      try {
        await delayPromise;
      } catch {
        // Expected to throw
      }
      
      // Timer should be cleaned up
      expect(timerManager.getStats().timers).toBe(initialTimerCount);
    });
  });

  describe("getStats", () => {
    it("should return accurate counts", () => {
      const initialStats = timerManager.getStats();
      
      const timer1 = timerManager.setTimeout(() => {}, 1000);
      const timer2 = timerManager.setTimeout(() => {}, 1000);
      const interval1 = timerManager.setInterval(() => {}, 1000);
      const controller1 = timerManager.createAbortController();
      
      const stats = timerManager.getStats();
      expect(stats.timers).toBe(initialStats.timers + 2);
      expect(stats.intervals).toBe(initialStats.intervals + 1);
      expect(stats.abortControllers).toBe(initialStats.abortControllers + 1);
      
      // Clean up
      timerManager.clearTimeout(timer1);
      timerManager.clearTimeout(timer2);
      timerManager.clearInterval(interval1);
      timerManager.removeAbortController(controller1);
    });
  });
});