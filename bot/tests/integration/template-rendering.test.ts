import { ChartRenderer } from "../../src/application/chart/ChartRenderer";
import { ChartData } from "../../src/application/chart/ChartService";

// Mock the logger
jest.mock("../../src/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock feature flags to use basic strategy
jest.mock("../../src/shared/utilities/feature-flags", () => ({
  flags: {
    newChartRendering: false,
  },
}));

describe("Template Rendering Integration", () => {
  beforeEach(() => {
    ChartRenderer.resetStrategy();
  });

  it("should render HTML charts asynchronously", async () => {
    const chartData: ChartData = {
      labels: ["January", "February", "March"],
      datasets: [
        {
          label: "Sales",
          data: [100, 150, 200],
          backgroundColor: "#4CAF50",
          borderColor: "#4CAF50",
        },
        {
          label: "Expenses",
          data: [80, 100, 120],
          backgroundColor: "#F44336",
          borderColor: "#F44336",
        },
      ],
    };

    const html = await ChartRenderer.renderHTML(chartData, {
      title: "Monthly Report",
      showLegend: true,
      lightMode: false,
    });

    // Verify the HTML contains expected elements
    expect(html).toContain("<title>Monthly Report</title>");
    expect(html).toContain("<h1>Monthly Report</h1>");
    expect(html).toContain("Sales");
    expect(html).toContain("Expenses");
    expect(html).toContain("January");
    expect(html).toContain("February");
    expect(html).toContain("March");
    expect(html).toContain("100");
    expect(html).toContain("150");
    expect(html).toContain("200");
    expect(html).toContain("background-color: #2b2b2b"); // Dark mode
  });

  it("should handle errors gracefully", async () => {
    // Force an error by passing invalid data
    const result = await ChartRenderer.renderHTML(null as any);

    expect(result).toContain("Error rendering chart");
  });
});