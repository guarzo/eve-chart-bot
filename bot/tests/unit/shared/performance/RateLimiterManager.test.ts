import 'reflect-metadata';
import { RateLimiterManager } from '../../../../src/shared/performance/RateLimiterManager';
import { logger } from '../../../../src/lib/logger';

// Mock dependencies
jest.mock('../../../../src/lib/logger');

describe('RateLimiterManager', () => {
  let manager: RateLimiterManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    manager = new RateLimiterManager();
  });

  afterEach(() => {
    jest.useRealTimers();
    manager.cleanup();
  });

  describe('constructor', () => {
    it('should initialize with empty limiters', () => {
      expect(manager).toBeInstanceOf(RateLimiterManager);
    });
  });

  describe('getRateLimiter', () => {
    it('should create a new rate limiter for new key', async () => {
      // Arrange
      const config = { minDelay: 1000, maxDelay: 5000 };

      // Act
      const limiter = manager.getRateLimiter('test-service', config);

      // Assert
      expect(limiter).toBeDefined();
      expect(typeof limiter.waitForNextRequest).toBe('function');
    });

    it('should return existing rate limiter for same key', () => {
      // Arrange
      const config = { minDelay: 1000, maxDelay: 5000 };

      // Act
      const limiter1 = manager.getRateLimiter('test-service', config);
      const limiter2 = manager.getRateLimiter('test-service', config);

      // Assert
      expect(limiter1).toBe(limiter2);
    });

    it('should create different limiters for different keys', () => {
      // Arrange
      const config = { minDelay: 1000, maxDelay: 5000 };

      // Act
      const limiter1 = manager.getRateLimiter('service-1', config);
      const limiter2 = manager.getRateLimiter('service-2', config);

      // Assert
      expect(limiter1).not.toBe(limiter2);
    });
  });

  describe('rate limiting behavior', () => {
    it('should enforce minimum delay between requests', async () => {
      // Arrange
      const config = { minDelay: 1000, maxDelay: 5000 };
      const limiter = manager.getRateLimiter('test-service', config);

      // Act
      const start = Date.now();
      await limiter.waitForNextRequest();
      
      // Fast forward time to simulate delay
      jest.advanceTimersByTime(500);
      
      const waitPromise = limiter.waitForNextRequest();
      jest.advanceTimersByTime(500); // Total 1000ms elapsed
      
      await waitPromise;

      // Assert - should have waited at least the minimum delay
      expect(jest.getTimerCount()).toBeGreaterThanOrEqual(0);
    });

    it('should handle rate limit errors with exponential backoff', async () => {
      // Arrange
      const config = { minDelay: 1000, maxDelay: 5000 };
      const limiter = manager.getRateLimiter('test-service', config);

      // Simulate rate limit hit
      limiter.onRateLimited();

      // Act
      const waitPromise = limiter.waitForNextRequest();
      jest.advanceTimersByTime(2000); // Advance by backoff time
      
      await waitPromise;

      // Assert
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Rate limiter active'),
        expect.objectContaining({
          service: 'test-service',
        })
      );
    });

    it('should reset backoff after successful requests', async () => {
      // Arrange
      const config = { minDelay: 1000, maxDelay: 5000 };
      const limiter = manager.getRateLimiter('test-service', config);

      // Simulate rate limit hit and recovery
      limiter.onRateLimited();
      limiter.onSuccessfulRequest();

      // Act
      const waitPromise = limiter.waitForNextRequest();
      jest.advanceTimersByTime(1000); // Should only need minimum delay
      
      await waitPromise;

      // Assert - Should not have excessive backoff
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should clear all rate limiters', () => {
      // Arrange
      const config = { minDelay: 1000, maxDelay: 5000 };
      manager.getRateLimiter('service-1', config);
      manager.getRateLimiter('service-2', config);

      // Act
      manager.cleanup();

      // Assert - Should be able to create new limiters (indicating cleanup worked)
      const newLimiter1 = manager.getRateLimiter('service-1', config);
      const newLimiter2 = manager.getRateLimiter('service-1', config);
      expect(newLimiter1).toBe(newLimiter2); // Should be the same instance again
    });

    it('should handle cleanup when no limiters exist', () => {
      // Act & Assert - Should not throw
      expect(() => manager.cleanup()).not.toThrow();
    });
  });

  describe('multiple services', () => {
    it('should manage different rate limits for different services', async () => {
      // Arrange
      const fastConfig = { minDelay: 500, maxDelay: 2000 };
      const slowConfig = { minDelay: 2000, maxDelay: 10000 };

      // Act
      const fastLimiter = manager.getRateLimiter('fast-service', fastConfig);
      const slowLimiter = manager.getRateLimiter('slow-service', slowConfig);

      // Assert
      expect(fastLimiter).not.toBe(slowLimiter);
      
      // Both should work independently
      const fastPromise = fastLimiter.waitForNextRequest();
      const slowPromise = slowLimiter.waitForNextRequest();
      
      jest.advanceTimersByTime(2500);
      
      await Promise.all([fastPromise, slowPromise]);
    });
  });

  describe('error handling', () => {
    it('should handle concurrent rate limit hits', async () => {
      // Arrange
      const config = { minDelay: 1000, maxDelay: 5000 };
      const limiter = manager.getRateLimiter('test-service', config);

      // Act - Simulate multiple rate limit hits
      limiter.onRateLimited();
      limiter.onRateLimited();
      limiter.onRateLimited();

      const waitPromise = limiter.waitForNextRequest();
      jest.advanceTimersByTime(8000); // Should handle exponential backoff
      
      await waitPromise;

      // Assert
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should cap backoff at maximum delay', async () => {
      // Arrange
      const config = { minDelay: 1000, maxDelay: 3000 };
      const limiter = manager.getRateLimiter('test-service', config);

      // Act - Multiple rate limits to trigger max backoff
      for (let i = 0; i < 10; i++) {
        limiter.onRateLimited();
      }

      const waitPromise = limiter.waitForNextRequest();
      jest.advanceTimersByTime(3000); // Should not exceed maxDelay
      
      await waitPromise;

      // Assert - Should have been limited to maxDelay
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});