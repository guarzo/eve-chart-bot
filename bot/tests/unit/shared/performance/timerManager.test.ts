import 'reflect-metadata';
import { TimerManager } from '../../../../src/shared/performance/timerManager';

describe('TimerManager', () => {
  let timerManager: TimerManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Get instance
    timerManager = TimerManager.getInstance();
  });

  afterEach(() => {
    jest.useRealTimers();
    timerManager.clearAllTimeouts();
    timerManager.clearAllIntervals();
  });

  describe('setTimeout', () => {
    it('should create and track a timeout', () => {
      // Arrange
      const callback = jest.fn();

      // Act
      const timeoutId = timerManager.setTimeout(callback, 1000);

      // Assert
      expect(timeoutId).toBeDefined();
      expect(callback).not.toHaveBeenCalled();
      
      // Fast forward and check callback is called
      jest.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should execute callback after specified delay', () => {
      // Arrange
      const callback = jest.fn();

      // Act
      timerManager.setTimeout(callback, 500);
      jest.advanceTimersByTime(499);
      
      // Assert - Should not be called yet
      expect(callback).not.toHaveBeenCalled();
      
      // Advance by 1 more ms
      jest.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to callback', () => {
      // Arrange
      const callback = jest.fn();
      const args = ['arg1', 'arg2', 123];

      // Act
      timerManager.setTimeout(callback, 100, ...args);
      jest.advanceTimersByTime(100);

      // Assert
      expect(callback).toHaveBeenCalledWith(...args);
    });

    it('should track multiple timeouts', () => {
      // Arrange
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      // Act
      const id1 = timerManager.setTimeout(callback1, 100);
      const id2 = timerManager.setTimeout(callback2, 200);

      // Assert
      expect(id1).not.toBe(id2);
      
      jest.advanceTimersByTime(100);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(100);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearTimeout', () => {
    it('should clear a timeout before execution', () => {
      // Arrange
      const callback = jest.fn();
      const timeoutId = timerManager.setTimeout(callback, 1000);

      // Act
      timerManager.clearTimeout(timeoutId);
      jest.advanceTimersByTime(1000);

      // Assert
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle clearing non-existent timeout', () => {
      // Act & Assert - Should not throw
      expect(() => timerManager.clearTimeout('non-existent')).not.toThrow();
    });
  });

  describe('setInterval', () => {
    it('should create and track an interval', () => {
      // Arrange
      const callback = jest.fn();

      // Act
      const intervalId = timerManager.setInterval(callback, 500);

      // Assert
      expect(intervalId).toBeDefined();
      expect(callback).not.toHaveBeenCalled();
      
      // Should be called repeatedly
      jest.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(1);
      
      jest.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(2);
      
      jest.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should pass arguments to interval callback', () => {
      // Arrange
      const callback = jest.fn();
      const args = ['test', 42];

      // Act
      timerManager.setInterval(callback, 100, ...args);
      jest.advanceTimersByTime(200);

      // Assert
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, ...args);
      expect(callback).toHaveBeenNthCalledWith(2, ...args);
    });
  });

  describe('clearInterval', () => {
    it('should clear an interval', () => {
      // Arrange
      const callback = jest.fn();
      const intervalId = timerManager.setInterval(callback, 100);

      // Act
      jest.advanceTimersByTime(200);
      expect(callback).toHaveBeenCalledTimes(2);
      
      timerManager.clearInterval(intervalId);
      jest.advanceTimersByTime(200);

      // Assert
      expect(callback).toHaveBeenCalledTimes(2); // Should not be called again
    });

    it('should handle clearing non-existent interval', () => {
      // Act & Assert - Should not throw
      expect(() => timerManager.clearInterval('non-existent')).not.toThrow();
    });
  });

  describe('clearAllTimeouts', () => {
    it('should clear all tracked timeouts', () => {
      // Arrange
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();
      
      timerManager.setTimeout(callback1, 100);
      timerManager.setTimeout(callback2, 200);
      timerManager.setTimeout(callback3, 300);

      // Act
      timerManager.clearAllTimeouts();
      jest.advanceTimersByTime(300);

      // Assert
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();
    });

    it('should handle clearing when no timeouts exist', () => {
      // Act & Assert - Should not throw
      expect(() => timerManager.clearAllTimeouts()).not.toThrow();
    });
  });

  describe('clearAllIntervals', () => {
    it('should clear all tracked intervals', () => {
      // Arrange
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      timerManager.setInterval(callback1, 100);
      timerManager.setInterval(callback2, 150);
      
      // Let them run once
      jest.advanceTimersByTime(200);
      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(1);

      // Act
      timerManager.clearAllIntervals();
      jest.advanceTimersByTime(200);

      // Assert - Should not be called again
      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    it('should return correct stats for timeouts and intervals', () => {
      // Arrange
      timerManager.setTimeout(() => {}, 100);
      timerManager.setTimeout(() => {}, 200);
      timerManager.setInterval(() => {}, 300);

      // Act
      const stats = timerManager.getStats();

      // Assert
      expect(stats).toEqual({
        activeTimeouts: 2,
        activeIntervals: 1,
        totalCreated: 3,
      });
    });

    it('should update stats after clearing timers', () => {
      // Arrange
      const timeoutId = timerManager.setTimeout(() => {}, 100);
      const intervalId = timerManager.setInterval(() => {}, 200);

      // Act
      timerManager.clearTimeout(timeoutId);
      const stats = timerManager.getStats();

      // Assert
      expect(stats).toEqual({
        activeTimeouts: 0,
        activeIntervals: 1,
        totalCreated: 2,
      });
    });

    it('should return zero stats when no timers exist', () => {
      // Act
      const stats = timerManager.getStats();

      // Assert
      expect(stats).toEqual({
        activeTimeouts: 0,
        activeIntervals: 0,
        totalCreated: 0,
      });
    });
  });

  describe('cleanup on execution', () => {
    it('should automatically remove timeout from tracking after execution', () => {
      // Arrange
      const callback = jest.fn();
      timerManager.setTimeout(callback, 100);

      // Act
      jest.advanceTimersByTime(100);
      const stats = timerManager.getStats();

      // Assert
      expect(callback).toHaveBeenCalledTimes(1);
      expect(stats.activeTimeouts).toBe(0);
      expect(stats.totalCreated).toBe(1);
    });

    it('should handle errors in timeout callbacks gracefully', () => {
      // Arrange
      const errorCallback = jest.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = jest.fn();

      // Act
      timerManager.setTimeout(errorCallback, 100);
      timerManager.setTimeout(normalCallback, 200);

      // Should not throw when error callback executes
      expect(() => jest.advanceTimersByTime(100)).not.toThrow();
      jest.advanceTimersByTime(100);

      // Assert
      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(normalCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('memory management', () => {
    it('should not leak memory with many short-lived timers', () => {
      // Arrange & Act
      for (let i = 0; i < 100; i++) {
        timerManager.setTimeout(() => {}, 1);
      }
      
      jest.advanceTimersByTime(1);
      const stats = timerManager.getStats();

      // Assert
      expect(stats.activeTimeouts).toBe(0);
      expect(stats.totalCreated).toBe(100);
    });
  });
});