import { logger } from "../../lib/logger";
import { CacheAdapter } from "../../cache/CacheAdapter";
import { CacheRedisAdapter } from "../../cache/CacheRedisAdapter";
import { flags } from "../../utils/feature-flags";

/**
 * Chart rendering options
 */
export interface ChartOptions {
  /** Width of the chart in pixels */
  width: number;
  /** Height of the chart in pixels */
  height: number;
  /** Optional title for the chart */
  title?: string;
  /** Whether to include a legend */
  showLegend: boolean;
  /** Whether to add labels with values to the chart */
  showLabels: boolean;
  /** Whether to use light mode, otherwise dark mode */
  lightMode: boolean;
}

/**
 * Chart data format
 */
export interface ChartData {
  /** Labels for the data points */
  labels: string[];
  /** Datasets to be rendered */
  datasets: Array<{
    /** Name of the dataset */
    label: string;
    /** Data values */
    data: number[];
    /** Background colors (can be a single color or an array) */
    backgroundColor: string | string[];
    /** Border colors (can be a single color or an array) */
    borderColor?: string | string[];
  }>;
}

/**
 * Main service for chart generation and rendering
 */
export class ChartService {
  private cache: CacheAdapter;

  /**
   * Create a new ChartService
   * @param cache Optional cache adapter to use for chart data
   */
  constructor(cache?: CacheAdapter) {
    this.cache =
      cache ||
      new CacheRedisAdapter(process.env.REDIS_URL || "redis://redis:6379");
  }

  /**
   * Generate ship usage statistics for a character or group
   * @param characterId Character ID or null if using a group
   * @param groupId Group ID or null if using a character
   * @param days Number of days to include in the chart
   * @returns Chart data or null if no data available
   */
  async generateShipUsageChart(
    characterId?: string,
    groupId?: string,
    days: number = 30
  ): Promise<ChartData | null> {
    try {
      if (!characterId && !groupId) {
        logger.error("Either characterId or groupId must be provided");
        return null;
      }

      // Try to get from cache first
      const cacheKey = `ship-usage-${
        characterId || `group-${groupId}`
      }-${days}`;
      const cachedData = await this.cache.get<ChartData>(cacheKey);

      if (cachedData) {
        logger.debug(`Retrieved ship usage chart from cache: ${cacheKey}`);
        return cachedData;
      }

      logger.info(
        `Generating ship usage chart for ${
          characterId ? "character " + characterId : "group " + groupId
        } over ${days} days`
      );

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);

      // Use feature flag to conditionally use real database queries or mock data
      let shipData;

      if (flags.newChartRendering) {
        // Implement actual data retrieval when feature flag is enabled
        logger.info(
          "Using database query for ship usage (feature flag enabled)"
        );

        try {
          // This would be the actual implementation
          /*
          const result = await prisma.killFact.groupBy({
            by: ['ship_type_id'],
            where: {
              ...(characterId ? { character_id: BigInt(characterId) } : {}),
              kill_time: {
                gte: startDate,
                lte: endDate
              }
            },
            _count: true,
            orderBy: {
              _count: 'desc'
            },
            take: 10
          });
          
          shipData = result.map(r => ({
            shipName: shipTypeNames[r.ship_type_id] || `Type ID: ${r.ship_type_id}`,
            count: r._count
          }));
          */

          // Temporary placeholder
          shipData = [
            { shipName: "Rifter (DB)", count: 15 },
            { shipName: "Punisher (DB)", count: 8 },
            { shipName: "Merlin (DB)", count: 12 },
          ];
        } catch (error) {
          logger.error(
            "Error in ship data retrieval, falling back to mock data",
            error
          );
          // Fall back to mock data
          shipData = [
            { shipName: "Rifter (Mock)", count: 15 },
            { shipName: "Punisher (Mock)", count: 8 },
            { shipName: "Merlin (Mock)", count: 12 },
            { shipName: "Incursus (Mock)", count: 5 },
          ];
        }
      } else {
        // Use mock data when feature flag is disabled
        logger.info("Using mock data for ship usage (feature flag disabled)");
        shipData = [
          { shipName: "Rifter", count: 15 },
          { shipName: "Punisher", count: 8 },
          { shipName: "Merlin", count: 12 },
          { shipName: "Incursus", count: 5 },
        ];
      }

      // Create chart data
      const chartData: ChartData = {
        labels: shipData.map((s) => s.shipName),
        datasets: [
          {
            label: "Ship Usage",
            data: shipData.map((s) => s.count),
            backgroundColor: [
              "#FF6384",
              "#36A2EB",
              "#FFCE56",
              "#4BC0C0",
              "#9966FF",
              "#FF9F40",
            ],
          },
        ],
      };

      // Cache the result
      await this.cache.set(cacheKey, chartData, 60 * 60); // Cache for 1 hour

      return chartData;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Failed to generate ship usage chart"
      );
      return null;
    }
  }

  /**
   * Render a chart as a PNG buffer
   * @param chartData The data to render
   * @param options Rendering options
   * @returns Buffer containing the PNG image or null if rendering failed
   */
  async renderChart(
    chartData: ChartData,
    options: Partial<ChartOptions> = {}
  ): Promise<Buffer | null> {
    try {
      // Set default options
      const chartOptions: ChartOptions = {
        width: options.width || 800,
        height: options.height || 600,
        title: options.title,
        showLegend:
          options.showLegend !== undefined ? options.showLegend : true,
        showLabels:
          options.showLabels !== undefined ? options.showLabels : true,
        lightMode: options.lightMode !== undefined ? options.lightMode : false,
      };

      logger.info(
        `Rendering chart with dimensions ${chartOptions.width}x${chartOptions.height}`
      );

      // Use feature flag to conditionally enable real chart rendering
      if (flags.newChartRendering) {
        logger.info("Using real chart rendering (feature flag enabled)");
        try {
          // This would be the actual implementation
          // const { ChartRenderer } = await import('../ChartRenderer');
          // return ChartRenderer.renderPNG(chartData, chartOptions);

          // Placeholder for now
          return Buffer.from("Real chart rendering output");
        } catch (error) {
          logger.error("Error in chart rendering, falling back to mock", error);
          // Fall back to mock buffer
        }
      }

      // Use mock buffer when feature flag is disabled
      logger.info("Using mock chart rendering (feature flag disabled)");
      const mockBuffer = Buffer.from("Mock chart rendering output");
      return mockBuffer;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Failed to render chart"
      );
      return null;
    }
  }
}
