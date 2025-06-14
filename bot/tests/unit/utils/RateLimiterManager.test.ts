import { rateLimiterManager } from "../../../src/utils/RateLimiterManager";
import { RateLimiter } from "../../../src/utils/rateLimiter";

// Mock the dependencies
jest.mock("../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("../../../src/utils/timerManager", () => ({
  timerManager: {
    delay: jest.fn((ms) => Promise.resolve()),
  },
}));

describe("RateLimiterManager", () => {
  beforeEach(() => {
    // Clean up any existing rate limiters before each test
    rateLimiterManager.cleanup();
    jest.clearAllMocks();
  });

  describe("getRateLimiter", () => {
    it("should create a new rate limiter for a service", () => {
      const limiter = rateLimiterManager.getRateLimiter("TestService");
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it("should return the same rate limiter instance for the same service", () => {
      const limiter1 = rateLimiterManager.getRateLimiter("TestService");
      const limiter2 = rateLimiterManager.getRateLimiter("TestService");
      expect(limiter1).toBe(limiter2);
    });

    it("should use default configuration for known services", () => {
      const mapLimiter = rateLimiterManager.getRateLimiter("Map API");
      const zkillLimiter = rateLimiterManager.getRateLimiter("zKillboard");
      const esiLimiter = rateLimiterManager.getRateLimiter("ESI");
      
      // These should all be created without errors
      expect(mapLimiter).toBeInstanceOf(RateLimiter);
      expect(zkillLimiter).toBeInstanceOf(RateLimiter);
      expect(esiLimiter).toBeInstanceOf(RateLimiter);
    });

    it("should allow custom configuration to override defaults", () => {
      const limiter = rateLimiterManager.getRateLimiter("zKillboard", {
        minDelayMs: 2000
      });
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it("should create different rate limiters for different services", () => {
      const limiter1 = rateLimiterManager.getRateLimiter("Service1");
      const limiter2 = rateLimiterManager.getRateLimiter("Service2");
      expect(limiter1).not.toBe(limiter2);
    });
  });

  describe("reset", () => {
    it("should reset a specific rate limiter", () => {
      const limiter = rateLimiterManager.getRateLimiter("TestService");
      const resetSpy = jest.spyOn(limiter, "reset");
      
      rateLimiterManager.reset("TestService");
      expect(resetSpy).toHaveBeenCalled();
    });

    it("should not throw if resetting a non-existent rate limiter", () => {
      expect(() => {
        rateLimiterManager.reset("NonExistentService");
      }).not.toThrow();
    });
  });

  describe("resetAll", () => {
    it("should reset all rate limiters", () => {
      const limiter1 = rateLimiterManager.getRateLimiter("Service1");
      const limiter2 = rateLimiterManager.getRateLimiter("Service2");
      
      const resetSpy1 = jest.spyOn(limiter1, "reset");
      const resetSpy2 = jest.spyOn(limiter2, "reset");
      
      rateLimiterManager.resetAll();
      
      expect(resetSpy1).toHaveBeenCalled();
      expect(resetSpy2).toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should reset and clear all rate limiters", () => {
      const limiter1 = rateLimiterManager.getRateLimiter("Service1");
      const limiter2 = rateLimiterManager.getRateLimiter("Service2");
      
      const resetSpy1 = jest.spyOn(limiter1, "reset");
      const resetSpy2 = jest.spyOn(limiter2, "reset");
      
      rateLimiterManager.cleanup();
      
      expect(resetSpy1).toHaveBeenCalled();
      expect(resetSpy2).toHaveBeenCalled();
      
      // After cleanup, getting the same service should create a new instance
      const newLimiter1 = rateLimiterManager.getRateLimiter("Service1");
      expect(newLimiter1).not.toBe(limiter1);
    });
  });

  describe("getStats", () => {
    it("should return statistics for all rate limiters", () => {
      rateLimiterManager.getRateLimiter("Service1");
      rateLimiterManager.getRateLimiter("Service2");
      
      const stats = rateLimiterManager.getStats();
      
      expect(stats).toHaveProperty("Service1");
      expect(stats).toHaveProperty("Service2");
      expect(stats.Service1).toHaveProperty("canMakeRequest");
      expect(stats.Service1).toHaveProperty("timeUntilNext");
      expect(stats.Service1.canMakeRequest).toBe(true);
      expect(stats.Service1.timeUntilNext).toBe(0);
    });
  });

  describe("singleton behavior", () => {
    it("should always return the same manager instance", () => {
      // Import fresh to test singleton
      const { rateLimiterManager: manager1 } = require("../../../src/utils/RateLimiterManager");
      const { rateLimiterManager: manager2 } = require("../../../src/utils/RateLimiterManager");
      
      expect(manager1).toBe(manager2);
    });
  });
});