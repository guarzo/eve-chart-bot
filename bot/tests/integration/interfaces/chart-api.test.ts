import {
  ChartService,
  ChartData,
} from "../../../src/application/chart/ChartService";
import { TestMemoryCache } from "../../setup";
import { prismaMock } from "../../setup";

// Use test double for cache to avoid Redis dependencies
const memoryCache = new TestMemoryCache();
const chartService = new ChartService(memoryCache);

describe("Chart API Integration", () => {
  afterAll(async () => {
    // Clean up any resources
    await memoryCache.clear();
    (memoryCache as any).dispose();
  });

  describe("Ship Usage Chart", () => {
    it("should generate a ship usage chart for a character", async () => {
      // Mock ship usage data in Prisma would go here

      // Request a chart
      const chartData = await chartService.generateShipUsageChart(
        12345n,
        undefined,
        30
      );

      // Verify the result
      expect(chartData).not.toBeNull();
      if (chartData) {
        expect(chartData.labels).toHaveLength(4); // Based on our mock data
        expect(chartData.datasets).toHaveLength(1);
        expect(chartData.datasets[0].data).toHaveLength(4);
      }
    });

    it("should retrieve chart data from cache on second request", async () => {
      // First, make sure we have data in the cache
      const chartData: ChartData = {
        labels: ["Ship1", "Ship2"],
        datasets: [
          {
            label: "Ship Usage",
            data: [10, 5],
            backgroundColor: ["#FF0000", "#0000FF"],
          },
        ],
      };

      // Manually add to cache
      await memoryCache.set("ship-usage-12345-30", chartData, 3600);

      // Spy on cache.get
      const getSpy = jest.spyOn(memoryCache, "get");

      // Request the same chart
      const result = await chartService.generateShipUsageChart(
        12345n,
        undefined,
        30
      );

      // Verify it was retrieved from cache
      expect(getSpy).toHaveBeenCalledWith("ship-usage-12345-30");
      expect(result).toEqual(chartData);
    });

    it("should return null when no character or group ID is provided", async () => {
      const result = await chartService.generateShipUsageChart(
        undefined,
        undefined,
        30
      );
      expect(result).toBeNull();
    });
  });
});
