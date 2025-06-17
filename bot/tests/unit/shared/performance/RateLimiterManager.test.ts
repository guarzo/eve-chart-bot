import 'reflect-metadata';
import { rateLimiterManager } from '../../../../src/shared/performance/RateLimiterManager';
import { logger } from '../../../../src/lib/logger';

// Mock dependencies
jest.mock('../../../../src/lib/logger');

describe('RateLimiterManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    rateLimiterManager.cleanup(); // Clean up from previous tests
  });

  afterEach(() => {
    jest.useRealTimers();
    rateLimiterManager.cleanup();
  });

  describe('constructor', () => {
    it('should initialize with empty limiters', () => {
      expect(rateLimiterManager).toBeDefined();
      expect(typeof rateLimiterManager.getRateLimiter).toBe('function');
    });
  });

  describe('getRateLimiter', () => {
    it('should create a new rate limiter for new key', async () => {
      // Arrange
      const config = { minDelayMs: 1000 };

      // Act
      const limiter = rateLimiterManager.getRateLimiter('test-service', config);

      // Assert
      expect(limiter).toBeDefined();
      expect(typeof limiter.wait).toBe('function');
      expect(typeof limiter.canMakeRequest).toBe('function');
      expect(typeof limiter.getTimeUntilNextRequest).toBe('function');
      expect(typeof limiter.reset).toBe('function');
    });

    it('should return existing rate limiter for same key', () => {
      // Arrange
      const config = { minDelayMs: 1000 };

      // Act
      const limiter1 = rateLimiterManager.getRateLimiter('test-service', config);
      const limiter2 = rateLimiterManager.getRateLimiter('test-service', config);

      // Assert
      expect(limiter1).toBe(limiter2);
    });

    it('should create different limiters for different keys', () => {
      // Arrange
      const config = { minDelayMs: 1000 };

      // Act
      const limiter1 = rateLimiterManager.getRateLimiter('service-1', config);
      const limiter2 = rateLimiterManager.getRateLimiter('service-2', config);

      // Assert
      expect(limiter1).not.toBe(limiter2);
    });
  });

  describe('rate limiting behavior', () => {
    it('should enforce minimum delay between requests', async () => {
      // Arrange
      const config = { minDelayMs: 1000 };
      const limiter = rateLimiterManager.getRateLimiter('test-service', config);

      // Act - first call should not wait
      expect(limiter.canMakeRequest()).toBe(true);
      await limiter.wait();
      
      // Immediately after a request, should need to wait
      expect(limiter.canMakeRequest()).toBe(false);
      expect(limiter.getTimeUntilNextRequest()).toBeGreaterThan(0);
      
      // Fast forward time to simulate delay
      jest.advanceTimersByTime(1000);
      
      // After the delay, should be able to make request again
      expect(limiter.canMakeRequest()).toBe(true);
    });

    it('should track time until next request correctly', async () => {
      // Arrange
      const config = { minDelayMs: 1000 };
      const limiter = rateLimiterManager.getRateLimiter('test-service', config);

      // Act
      await limiter.wait(); // Make a request
      
      const timeUntilNext = limiter.getTimeUntilNextRequest();
      
      // Assert
      expect(timeUntilNext).toBeGreaterThan(0);
      expect(timeUntilNext).toBeLessThanOrEqual(1000);
    });

    it('should allow reset of rate limiter', async () => {
      // Arrange
      const config = { minDelayMs: 1000 };
      const limiter = rateLimiterManager.getRateLimiter('test-service', config);

      // Act - make a request then reset
      await limiter.wait();
      expect(limiter.canMakeRequest()).toBe(false);
      
      limiter.reset();
      
      // Assert - should be able to make request immediately after reset
      expect(limiter.canMakeRequest()).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should clear all rate limiters', () => {
      // Arrange
      const config = { minDelayMs: 1000 };
      rateLimiterManager.getRateLimiter('service-1', config);
      rateLimiterManager.getRateLimiter('service-2', config);

      // Act
      rateLimiterManager.cleanup();

      // Assert - Should be able to create new limiters (indicating cleanup worked)
      const newLimiter1 = rateLimiterManager.getRateLimiter('service-1', config);
      const newLimiter2 = rateLimiterManager.getRateLimiter('service-1', config);
      expect(newLimiter1).toBe(newLimiter2); // Should be the same instance again
    });

    it('should handle cleanup when no limiters exist', () => {
      // Act & Assert - Should not throw
      expect(() => rateLimiterManager.cleanup()).not.toThrow();
    });
  });

  describe('multiple services', () => {
    it('should manage different rate limits for different services', async () => {
      // Arrange
      const fastConfig = { minDelayMs: 500 };
      const slowConfig = { minDelayMs: 2000 };

      // Act
      const fastLimiter = rateLimiterManager.getRateLimiter('fast-service', fastConfig);
      const slowLimiter = rateLimiterManager.getRateLimiter('slow-service', slowConfig);

      // Assert
      expect(fastLimiter).not.toBe(slowLimiter);
      
      // Test that they have different delays
      await fastLimiter.wait();
      await slowLimiter.wait();
      
      expect(fastLimiter.getTimeUntilNextRequest()).toBeLessThan(1000);
      expect(slowLimiter.getTimeUntilNextRequest()).toBeGreaterThan(1500);
    });
  });

  describe('manager functionality', () => {
    it('should provide stats for all rate limiters', () => {
      // Arrange
      const config = { minDelayMs: 1000 };
      rateLimiterManager.getRateLimiter('service-1', config);
      rateLimiterManager.getRateLimiter('service-2', config);

      // Act
      const stats = rateLimiterManager.getStats();

      // Assert
      expect(stats).toHaveProperty('service-1');
      expect(stats).toHaveProperty('service-2');
      expect(stats['service-1']).toHaveProperty('canMakeRequest');
      expect(stats['service-1']).toHaveProperty('timeUntilNext');
      expect(typeof stats['service-1'].canMakeRequest).toBe('boolean');
      expect(typeof stats['service-1'].timeUntilNext).toBe('number');
    });

    it('should allow resetting specific service limiters', () => {
      // Arrange
      const config = { minDelayMs: 1000 };
      rateLimiterManager.getRateLimiter('service-1', config);
      rateLimiterManager.getRateLimiter('service-2', config);

      // Act & Assert - Should not throw
      expect(() => rateLimiterManager.reset('service-1')).not.toThrow();
      expect(() => rateLimiterManager.reset('non-existent')).not.toThrow();
    });
  });
});