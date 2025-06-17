import { MapClient } from "../../../../src/infrastructure/http/MapClient";
import { rateLimiterManager } from "../../../../src/shared/performance/RateLimiterManager";
import { RateLimiter } from "../../../../src/shared/performance/rateLimiter";

// Mock dependencies
jest.mock("../../../../src/infrastructure/http/UnifiedESIClient");
jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("MapClient", () => {
  let mapClient: MapClient;
  let mockRateLimiter: jest.Mocked<RateLimiter>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock rate limiter
    mockRateLimiter = {
      wait: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn(),
      canMakeRequest: jest.fn().mockReturnValue(true),
      getTimeUntilNextRequest: jest.fn().mockReturnValue(0),
    } as any;

    // Mock the rate limiter manager to return our mock
    jest.spyOn(rateLimiterManager, "getRateLimiter").mockReturnValue(mockRateLimiter);

    mapClient = new MapClient("https://test-api.com", "test-api-key");
  });

  afterEach(() => {
    mapClient.cleanup();
  });

  describe("constructor", () => {
    it("should get the shared rate limiter from the manager", () => {
      expect(rateLimiterManager.getRateLimiter).toHaveBeenCalledWith("Map API");
    });
  });

  describe("cleanup", () => {
    it("should not reset the rate limiter (managed by singleton)", () => {
      mapClient.cleanup();
      expect(mockRateLimiter.reset).not.toHaveBeenCalled();
    });
  });
});