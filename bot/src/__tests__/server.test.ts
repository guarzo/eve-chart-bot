import request from "supertest";
import { ChartService } from "../services/ChartService";
import { ChartRenderer } from "../services/ChartRenderer";

// First mock all dependencies
jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      character: {
        count: jest.fn().mockResolvedValue(10),
        findMany: jest.fn().mockResolvedValue([]),
      },
      killFact: {
        count: jest.fn().mockResolvedValue(20),
        findMany: jest.fn().mockResolvedValue([]),
      },
      lossFact: {
        count: jest.fn().mockResolvedValue(30),
        findMany: jest.fn().mockResolvedValue([]),
      },
      mapActivity: {
        count: jest.fn().mockResolvedValue(40),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $on: jest.fn(),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    })),
  };
});

// Mock Chart.js and Canvas
jest.mock("chart.js", () => {
  return {
    Chart: class MockChart {
      constructor() {}
      render() {}
      toBuffer() {
        return Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      }
      destroy() {}
      static register() {}
    },
    registerables: [],
    register: jest.fn(),
  };
});

jest.mock("canvas", () => {
  return {
    createCanvas: jest.fn(() => ({
      getContext: jest.fn(() => ({
        fillRect: jest.fn(),
        fillStyle: "",
      })),
      toBuffer: jest.fn(() => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
    })),
  };
});

// Now import the app after mocks are set up
jest.mock("../services/ChartService");
jest.mock("../services/ChartRenderer");

// Import the app after all mocks are set up
import app from "../server";

describe("API Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ChartService methods
    (ChartService.prototype.generateChart as jest.Mock).mockResolvedValue({
      labels: ["2023-01-01", "2023-01-02"],
      datasets: [{ label: "Test", data: [10, 20] }],
    });

    // Mock ChartRenderer methods
    const mockBuffer = Buffer.from("test-image");
    (ChartRenderer.prototype.renderToBuffer as jest.Mock).mockResolvedValue(
      mockBuffer
    );
  });

  describe("GET /health", () => {
    it("should return 200 OK", async () => {
      const response = await request(app).get("/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });

  describe("GET /v1/charts/types", () => {
    it("should return available chart types", async () => {
      const response = await request(app).get("/v1/charts/types");
      expect(response.status).toBe(200);
      expect(response.body.types).toHaveLength(2);
      expect(response.body.types[0].id).toBe("kills");
      expect(response.body.types[1].id).toBe("map_activity");
    });
  });

  describe("GET /debug/counts", () => {
    it("should return database counts", async () => {
      // Override the default app.locals.prisma with our custom mocks
      app.locals.prisma = {
        mapActivity: { count: jest.fn().mockResolvedValue(40) },
        lossFact: { count: jest.fn().mockResolvedValue(30) },
        killFact: { count: jest.fn().mockResolvedValue(20) },
        character: { count: jest.fn().mockResolvedValue(10) },
      };

      const response = await request(app).get("/debug/counts");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
      expect(response.body.counts).toEqual({
        mapActivity: 40,
        losses: 30,
        kills: 20,
        characters: 10,
      });
    });
  });
});
