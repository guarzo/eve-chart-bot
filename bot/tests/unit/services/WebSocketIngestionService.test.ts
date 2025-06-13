import { WebSocketIngestionService } from "../../../src/services/ingestion/WebSocketIngestionService";
import { PrismaClient } from "@prisma/client";
import { jest } from "@jest/globals";

describe("WebSocketIngestionService", () => {
  let service: WebSocketIngestionService;
  let mockPrisma: any;

  beforeEach(() => {
    // Mock PrismaClient
    mockPrisma = {
      character: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      killFact: {
        upsert: jest.fn(),
      },
      killVictim: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      killAttacker: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      killCharacter: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      lossFact: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    service = new WebSocketIngestionService(
      {
        url: "ws://localhost:4004",
        reconnectIntervalMs: 1000,
        maxReconnectAttempts: 3,
        timeout: 5000,
      },
      mockPrisma as unknown as PrismaClient
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getStatus", () => {
    it("should return the service status", () => {
      const status = service.getStatus();

      expect(status).toEqual({
        isRunning: false,
        isConnected: false,
        subscribedCharacters: 0,
        subscribedSystems: 0,
      });
    });
  });

  describe("WebSocket connection", () => {
    it("should handle configuration correctly", () => {
      const config = {
        url: "ws://test.example.com",
        reconnectIntervalMs: 2000,
        maxReconnectAttempts: 5,
        timeout: 10000,
      };

      const testService = new WebSocketIngestionService(config, mockPrisma);
      
      // Service should be created with the provided config
      expect(testService).toBeDefined();
      expect(testService.getStatus().isRunning).toBe(false);
    });
  });

  // Note: More comprehensive tests would require mocking the Phoenix Socket
  // which is complex due to its WebSocket nature. In a real application,
  // you might want to use integration tests or mock the Socket at a higher level.
});