/**
 * Jest setup file
 * This file is run before any tests, setting up mocks and environment
 */

// Mock the logger to avoid worker processes hanging
jest.mock("../lib/logger", () => ({
  logger: {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockImplementation(() => ({
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    })),
  },
}));

// Mock Chart.js to avoid issues with Node.js canvas
jest.mock("chart.js", () => {
  const mockChart = class MockChart {
    constructor() {}
    render() {}
    toBuffer() {
      // Return a minimal valid PNG buffer header
      return Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
      ]);
    }
    destroy() {}
  };

  // Add static register method to the Chart class
  mockChart.register = jest.fn();

  return {
    Chart: mockChart,
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

// Mock Redis to avoid actual connections
const mockRedisInstance = {
  on: jest.fn().mockImplementation((event, callback) => {
    if (event === "ready") {
      // Immediately call ready callback to avoid waiting
      callback();
    }
    return mockRedisInstance;
  }),
  connect: jest.fn(),
  disconnect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  expire: jest.fn().mockResolvedValue(1),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  publish: jest.fn(),
};

// Mock Redis class constructor
jest.mock("ioredis", () => {
  const RedisMock = jest.fn().mockImplementation(() => mockRedisInstance);
  // Add properties to make it work as a constructor
  RedisMock.prototype = mockRedisInstance;
  return RedisMock;
});

// Mock Prisma explicitly to avoid TS errors
jest.mock("@prisma/client", () => {
  const mockFindMany = jest.fn().mockResolvedValue([]);
  const mockFindUnique = jest.fn().mockResolvedValue(null);
  const mockCount = jest.fn().mockResolvedValue(0);
  const mockUpsert = jest.fn().mockResolvedValue({});

  // Create a mock function generator that returns functions with mock methods
  const createMockFunction = () => {
    return jest.fn().mockImplementation(() => ({
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      count: mockCount,
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      upsert: mockUpsert,
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    }));
  };

  // Create the PrismaClient mock
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      character: createMockFunction()(),
      characterGroup: createMockFunction()(),
      killFact: createMockFunction()(),
      killAttacker: createMockFunction()(),
      killVictim: createMockFunction()(),
      lossFact: createMockFunction()(),
      mapActivity: createMockFunction()(),
      ingestionCheckpoint: createMockFunction()(),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(0),
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((callback) => callback({})),
      $on: jest.fn(), // Add the $on method
    })),
  };
});

// Mock environment variables
process.env.DISCORD_BOT_TOKEN = "mock-token";
process.env.ZKILLBOARD_API_URL = "http://mock-zkill-api.test";
process.env.MAP_API_URL = "http://mock-map-api.test";
process.env.MAP_API_KEY = "mock-map-key";
process.env.MAP_NAME = "mock-map";
process.env.REDIS_URL = "redis://mock";
process.env.CACHE_TTL = "300";
process.env.NODE_ENV = "test";

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  // Keep error and warn for debugging
  error: console.error,
  warn: console.warn,
};
