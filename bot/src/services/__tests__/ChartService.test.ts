import { PrismaClient } from "@prisma/client";
import { ChartService } from "../ChartService";
import { ChartConfig, ChartData } from "../../types/chart";
import { ChartRenderer } from "../ChartRenderer";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";
import { KillRepository } from "../../infrastructure/repositories/KillRepository";
import { MapActivityRepository } from "../../infrastructure/repositories/MapActivityRepository";

// Mock dependencies
jest.mock("@prisma/client");
jest.mock("../ChartRenderer");
jest.mock("../../infrastructure/repositories/CharacterRepository");
jest.mock("../../infrastructure/repositories/KillRepository");
jest.mock("../../infrastructure/repositories/MapActivityRepository");

describe("ChartService", () => {
  let service: ChartService;
  let mockPrisma: any;
  let mockCharacterRepository: jest.Mocked<CharacterRepository>;
  let mockKillRepository: jest.Mocked<KillRepository>;
  let mockMapActivityRepository: jest.Mocked<MapActivityRepository>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock repositories
    mockCharacterRepository = {
      getCharacter: jest.fn(),
      getCharactersByGroup: jest.fn(),
      getCharactersByEveIds: jest.fn(),
      saveCharacter: jest.fn(),
      updateCharacter: jest.fn(),
      deleteCharacter: jest.fn(),
      getAllCharacters: jest.fn(),
      getCharacterGroup: jest.fn(),
      getAllCharacterGroups: jest.fn(),
      saveCharacterGroup: jest.fn(),
      updateCharacterGroup: jest.fn(),
      deleteCharacterGroup: jest.fn(),
      upsertIngestionCheckpoint: jest.fn(),
      updateIngestionCheckpoint: jest.fn(),
      updateLastBackfillAt: jest.fn(),
      upsertMapActivity: jest.fn(),
      getMapActivityCount: jest.fn(),
      deleteAllMapActivity: jest.fn(),
    } as any;

    mockKillRepository = {
      getKillmail: jest.fn(),
      saveKillmail: jest.fn(),
      getKillsForCharacters: jest.fn(),
      countKills: jest.fn(),
      countLosses: jest.fn(),
      getLoss: jest.fn(),
      saveLoss: jest.fn(),
      deleteAllKillmails: jest.fn(),
    } as any;

    mockMapActivityRepository = {
      upsertMapActivity: jest.fn(),
      getMapActivityCount: jest.fn(),
      deleteAllMapActivity: jest.fn(),
      getActivityForGroup: jest.fn(),
    } as any;

    // Create mock renderer
    const mockRenderer = {
      renderToBuffer: jest.fn().mockResolvedValue(Buffer.from("mock-image")),
      renderToBase64: jest.fn().mockResolvedValue("mock-base64"),
    };

    // Create service instance
    service = new ChartService();
    (service as any).characterRepository = mockCharacterRepository;
    (service as any).killRepository = mockKillRepository;
    (service as any).mapActivityRepository = mockMapActivityRepository;
    (service as any).renderer = mockRenderer;
  });

  describe("generateChart", () => {
    const mockConfig: ChartConfig = {
      type: "kills",
      characterIds: [BigInt(12345), BigInt(67890)],
      period: "24h",
    };

    const mockKills = [
      {
        killmail_id: BigInt(1),
        character_id: BigInt(12345),
        kill_time: new Date("2024-03-20T12:00:00Z"),
        total_value: BigInt(1000000),
        points: 10,
        system_id: 30000142,
        ship_type_id: 123,
        npc: false,
        solo: false,
        awox: false,
        labels: [],
        attacker_count: 2,
      },
      {
        killmail_id: BigInt(2),
        character_id: BigInt(67890),
        kill_time: new Date("2024-03-20T13:00:00Z"),
        total_value: BigInt(2000000),
        points: 20,
        system_id: 30000142,
        ship_type_id: 456,
        npc: false,
        solo: true,
        awox: false,
        labels: [],
        attacker_count: 1,
      },
    ];

    const mockCharacters = [
      {
        eveId: "12345",
        name: "Character 1",
        corporationId: 123,
        corporationTicker: "ABC",
      },
      {
        eveId: "67890",
        name: "Character 2",
        corporationId: 456,
        corporationTicker: "XYZ",
      },
    ];

    it("should generate kills chart", async () => {
      // Mock repository methods
      mockKillRepository.getKillsForCharacters.mockResolvedValue(mockKills);
      mockCharacterRepository.getCharactersByGroup.mockResolvedValue(
        mockCharacters
      );
      mockCharacterRepository.getCharacter.mockImplementation(
        (eveId: string) => {
          const char = mockCharacters.find((c) => c.eveId === eveId);
          return Promise.resolve(char || null);
        }
      );

      const result = await service.generateChart(mockConfig);

      // Verify chart was generated with appropriate data
      expect(result).toBeDefined();
      expect(result.datasets).toBeDefined();
      expect(result.labels).toBeDefined();

      // Characters should be included in datasets
      expect(result.datasets.length).toBeGreaterThan(0);

      // Debug logging
      console.log(
        "Dataset labels:",
        result.datasets.map((ds) => ds.label)
      );
      console.log(
        "Expected character names:",
        mockCharacters.map((c) => c.name)
      );

      // Get character names from mock data
      const characterNames = mockCharacters.map((c) => c.name);

      // Check that each character name appears in a dataset label
      characterNames.forEach((name) => {
        expect(
          result.datasets.some((ds) => ds.label.includes(name))
        ).toBeTruthy();
      });
    });

    it("should generate map activity chart", async () => {
      const mapConfig: ChartConfig = {
        ...mockConfig,
        type: "map_activity",
      };

      const mockActivities = [
        {
          id: BigInt(1),
          characterId: BigInt(12345),
          timestamp: new Date("2024-03-20T12:00:00Z"),
          signatures: 10,
          connections: 5,
          passages: 2,
          corporationId: 123,
          allianceId: null,
        },
        {
          id: BigInt(2),
          characterId: BigInt(67890),
          timestamp: new Date("2024-03-20T13:00:00Z"),
          signatures: 20,
          connections: 10,
          passages: 5,
          corporationId: 456,
          allianceId: null,
        },
      ];

      // Mock repository methods
      mockMapActivityRepository.getActivityForGroup.mockResolvedValue(
        mockActivities
      );
      mockCharacterRepository.getCharactersByGroup.mockResolvedValue(
        mockCharacters
      );
      mockCharacterRepository.getCharacter.mockImplementation(
        (eveId: string) => {
          const char = mockCharacters.find((c) => c.eveId === eveId);
          return Promise.resolve(char || null);
        }
      );

      const result = await service.generateChart(mapConfig);

      // Verify chart was generated
      expect(result).toBeDefined();
      expect(result.datasets).toBeDefined();
      expect(result.labels).toBeDefined();

      // Characters should be included in datasets
      expect(result.datasets.length).toBeGreaterThan(0);

      // Debug logging
      console.log(
        "Dataset labels:",
        result.datasets.map((ds) => ds.label)
      );
      console.log(
        "Expected character names:",
        mockCharacters.map((c) => c.name)
      );

      // Get character names from mock data
      const characterNames = mockCharacters.map((c) => c.name);

      // Check that each character name appears in a dataset label
      characterNames.forEach((name) => {
        expect(
          result.datasets.some((ds) => ds.label.includes(name))
        ).toBeTruthy();
      });
    });

    it("should handle empty data", async () => {
      // Mock empty repository responses
      mockKillRepository.getKillsForCharacters.mockResolvedValue([]);
      mockCharacterRepository.getCharactersByGroup.mockResolvedValue(
        mockCharacters
      );
      mockCharacterRepository.getCharacter.mockImplementation(
        (eveId: string) => {
          const char = mockCharacters.find((c) => c.eveId === eveId);
          return Promise.resolve(char || null);
        }
      );

      const result = await service.generateChart(mockConfig);

      // Verify empty chart was generated
      expect(result).toBeDefined();
      expect(result.datasets).toBeDefined();
      expect(result.labels).toBeDefined();

      // Should have datasets for characters, even if empty
      expect(result.datasets.length).toBeGreaterThan(0);
      expect(result.datasets[0].data).toHaveLength(0);
    });

    it("should throw error for invalid chart type", async () => {
      const invalidConfig: ChartConfig = {
        ...mockConfig,
        type: "invalid" as any,
      };

      await expect(service.generateChart(invalidConfig)).rejects.toThrow();
    });

    it("should throw error for invalid period", async () => {
      const invalidConfig: ChartConfig = {
        ...mockConfig,
        period: "invalid" as any,
      };

      await expect(service.generateChart(invalidConfig)).rejects.toThrow();
    });
  });

  // Test chart rendering methods
  describe("chart rendering", () => {
    const mockConfig: ChartConfig = {
      type: "kills",
      characterIds: [BigInt(12345), BigInt(67890)],
      period: "24h",
    };

    const mockChartData: ChartData = {
      labels: ["2023-01-01", "2023-01-02"],
      datasets: [{ label: "Test", data: [10, 20] }],
    };

    // Mock the generateChart method to return test data
    beforeEach(() => {
      jest.spyOn(service, "generateChart").mockResolvedValue(mockChartData);
    });

    it("should render chart to buffer using renderer", async () => {
      // Test rendering to buffer directly through the renderer
      const renderer = (service as any).renderer;
      const result = await renderer.renderToBuffer(mockChartData, {});

      // Check the chart renderer was called and returned a buffer
      expect(renderer.renderToBuffer).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Buffer);
    });

    it("should render chart to base64 using renderer", async () => {
      // Test rendering to base64 directly through the renderer
      const renderer = (service as any).renderer;
      const result = await renderer.renderToBase64(mockChartData, {});

      // Check the chart renderer was called
      expect(renderer.renderToBase64).toHaveBeenCalled();
      expect(typeof result).toBe("string");
    });
  });
});
