// Mock Chart.js before importing ChartRenderer
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

// Mock canvas
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

import { ChartRenderer } from "../ChartRenderer";
import { ChartData, ChartOptions } from "../../types/chart";

describe("ChartRenderer", () => {
  let renderer: ChartRenderer;

  beforeEach(() => {
    renderer = new ChartRenderer(800, 400);
  });

  describe("renderToBuffer", () => {
    const mockData: ChartData = {
      labels: ["2024-03-20", "2024-03-21"],
      datasets: [
        {
          label: "Test Dataset",
          data: [10, 20],
          borderColor: "#FF6384",
          fill: false,
        },
      ],
    };

    const mockOptions: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: "Test Chart",
        },
      },
    };

    it("should render chart to buffer", async () => {
      const buffer = await renderer.renderToBuffer(mockData, mockOptions);

      // Verify buffer is a Buffer instance
      expect(buffer).toBeInstanceOf(Buffer);
      // Our mock returns a buffer that starts with the PNG header
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50); // P
      expect(buffer[2]).toBe(0x4e); // N
      expect(buffer[3]).toBe(0x47); // G
    });

    it("should render chart with multiple datasets", async () => {
      const multiDatasetData: ChartData = {
        ...mockData,
        datasets: [
          {
            label: "Dataset 1",
            data: [10, 20],
            borderColor: "#FF6384",
            fill: false,
          },
          {
            label: "Dataset 2",
            data: [15, 25],
            borderColor: "#36A2EB",
            fill: false,
          },
        ],
      };

      const buffer = await renderer.renderToBuffer(
        multiDatasetData,
        mockOptions
      );

      // Verify buffer is a Buffer instance
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it("should render chart with custom dimensions", async () => {
      const customRenderer = new ChartRenderer(1200, 600);
      const buffer = await customRenderer.renderToBuffer(mockData, mockOptions);

      // Verify buffer is a Buffer instance
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  describe("renderToBase64", () => {
    const mockData: ChartData = {
      labels: ["2024-03-20", "2024-03-21"],
      datasets: [
        {
          label: "Test Dataset",
          data: [10, 20],
          borderColor: "#FF6384",
          fill: false,
        },
      ],
    };

    const mockOptions: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: "Test Chart",
        },
      },
    };

    it("should render chart to base64 string", async () => {
      // Mock the renderToBuffer method to return a consistent buffer
      jest.spyOn(renderer, "renderToBuffer").mockResolvedValue(
        Buffer.from([0x89, 0x50, 0x4e, 0x47]) // Simple mock buffer
      );

      const base64 = await renderer.renderToBase64(mockData, mockOptions);

      // Verify it's a string
      expect(typeof base64).toBe("string");
      // Our implementation should call renderToBuffer
      expect(renderer.renderToBuffer).toHaveBeenCalled();
    });
  });
});
