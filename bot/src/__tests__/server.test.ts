import request from "supertest";
import app from "../server";
import { ChartService } from "../services/ChartService";
import { ChartRenderer } from "../services/ChartRenderer";
import { exec } from "child_process";
import { CharacterRepository } from "../infrastructure/repositories/CharacterRepository";
import { KillRepository } from "../infrastructure/repositories/KillRepository";
import { MapActivityRepository } from "../infrastructure/repositories/MapActivityRepository";

// Mock dependencies
jest.mock("child_process", () => ({
  exec: jest.fn((cmd, cb) => cb(null, { stdout: "", stderr: "" })),
}));
jest.mock("../lib/logger");
jest.mock("../services/ChartService");
jest.mock("../services/ChartRenderer");

// Mock repositories
jest.mock("../infrastructure/repositories/CharacterRepository");
jest.mock("../infrastructure/repositories/KillRepository");
jest.mock("../infrastructure/repositories/MapActivityRepository");

// Mock repository instances
const mockCharacterRepository = {
  count: jest.fn().mockResolvedValue(10),
  getAllCharacters: jest.fn().mockResolvedValue([]),
};

const mockKillRepository = {
  countKills: jest.fn().mockResolvedValue(20),
  countLosses: jest.fn().mockResolvedValue(15),
};

const mockMapActivityRepository = {
  count: jest.fn().mockResolvedValue(30),
};

// Set up mock implementations
(CharacterRepository as jest.Mock).mockImplementation(
  () => mockCharacterRepository
);
(KillRepository as jest.Mock).mockImplementation(() => mockKillRepository);
(MapActivityRepository as jest.Mock).mockImplementation(
  () => mockMapActivityRepository
);

describe("API Endpoints", () => {
  let mockExec: jest.MockedFunction<typeof exec>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mock exec
    mockExec = exec as jest.MockedFunction<typeof exec>;
    mockExec.mockImplementation((cmd, cb) => {
      if (cb) cb(null, { stdout: "", stderr: "" });
      return {} as any;
    });

    // Mock ChartService methods
    (ChartService as jest.Mock).mockImplementation(() => ({
      generateChart: jest.fn().mockResolvedValue({
        labels: ["2024-01-01"],
        datasets: [{ label: "Test", data: [10] }],
      }),
    }));

    // Mock ChartRenderer methods
    (ChartRenderer as jest.Mock).mockImplementation(() => ({
      renderToBuffer: jest.fn().mockResolvedValue(Buffer.from("mock-image")),
      renderToBase64: jest.fn().mockResolvedValue("mock-base64"),
    }));
  });

  afterEach(() => {
    // Clean up any remaining processes
    jest.resetAllMocks();
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
});
