/**
 * Jest setup file
 * This file is run before any tests, setting up mocks and environment
 */

import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "jest-mock-extended";

// Mock logger to prevent console output during tests
jest.mock("../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Redis to avoid real connections during tests
jest.mock("ioredis", () => {
  const Redis = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue(true),
  }));
  return { Redis };
});

// Create a mock Prisma client for testing
export const prismaMock = mockDeep<PrismaClient>();

// Mock the Prisma client for tests
jest.mock("../src/infrastructure/persistence/client", () => ({
  prisma: prismaMock,
}));

// Reset all mocks before each test
beforeEach(() => {
  mockReset(prismaMock);
});

// Set a longer timeout for integration tests
jest.setTimeout(30000);

// Set timezone to UTC for consistent date handling in tests
process.env.TZ = "UTC";

// Configure environment variables for testing
process.env.NODE_ENV = "test";
process.env.REDIS_URL = "redis://localhost:6379/1";
process.env.DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/eve_test";
process.env.MAP_API_URL = "https://example.com/map-api";
process.env.MAP_API_KEY = "test-api-key";
process.env.MAP_NAME = "mock-map";

// Mock Chart.js to avoid issues with Node.js canvas
jest.mock("chart.js", () => {
  return {
    Chart: class MockChart {
      constructor() {}
      render() {}
      toBuffer() {
        // Return a minimal valid PNG buffer header
        return Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
        ]);
      }
      destroy() {}
    },
    registerables: [],
  };
});

// Mock canvas for chart rendering
jest.mock("canvas", () => {
  return {
    createCanvas: jest.fn(() => ({
      getContext: jest.fn(() => ({
        fillRect: jest.fn(),
        fillStyle: "",
      })),
      toBuffer: jest.fn(() =>
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
      ),
    })),
  };
});

// Enhance the Prisma mock to properly support jest.fn()
jest.mock("@prisma/client", () => {
  const mockPrismaClient = jest.fn().mockImplementation(() => {
    return {
      // Add default mock implementations for all Prisma models
      character: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      characterGroup: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      killFact: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      killAttacker: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      killVictim: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      lossFact: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      mapActivity: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      ingestionCheckpoint: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(0),
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((callback) => callback({})),
    };
  });

  return {
    PrismaClient: mockPrismaClient,
  };
});

// Mock environment variables
process.env.DISCORD_BOT_TOKEN = "mock-token";
process.env.ZKILLBOARD_API_URL = "http://mock-zkill-api.test";
process.env.MAP_API_URL = "http://mock-map-api.test";
process.env.MAP_API_KEY = "mock-map-key";
process.env.REDIS_URL = "redis://mock";
process.env.CACHE_TTL = "300";

// Global setup
global.console = {
  ...console,
  // Add silent methods if needed
  log: jest.fn(),
  debug: jest.fn(),
  // Keep error and warn for debugging
  error: console.error,
  warn: console.warn,
  info: jest.fn(),
};

// Simple in-memory test double for CacheAdapter
export class TestMemoryCache {
  private store = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  // Optional: for compatibility with some tests
  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  // Optional: for compatibility with some tests
  dispose() {
    this.store.clear();
  }
}
