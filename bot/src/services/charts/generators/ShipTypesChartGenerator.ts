import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData } from "../../../types/chart";
import { ShipTypesChartConfig } from "../config";
import { KillRepository } from "../../../data/repositories";
import { format } from "date-fns";
import { logger } from "../../../lib/logger";
import axios from "axios";

/**
 * Generator for ship types charts
 */
export class ShipTypesChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;
  private shipTypeNameCache: Record<string, string> = {};

  constructor() {
    super();
    this.killRepository = new KillRepository();
  }

  /**
   * Generate a ship types chart based on the provided options
   */
  async generateChart(options: {
    startDate: Date;
    endDate: Date;
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>;
    displayType: string;
  }): Promise<ChartData> {
    try {
      const { startDate, endDate, characterGroups, displayType } = options;
      logger.info(
        `Generating ship types chart from ${startDate.toISOString()} to ${endDate.toISOString()}`
      );
      logger.debug(
        `Chart type: ${displayType}, Groups: ${characterGroups.length}`
      );

      // Select chart generation function based on display type
      if (displayType === "horizontalBar") {
        return this.generateHorizontalBarChart(
          characterGroups,
          startDate,
          endDate
        );
      } else if (displayType === "verticalBar") {
        return this.generateVerticalBarChart(
          characterGroups,
          startDate,
          endDate
        );
      } else {
        // Default to line chart (timeline)
        return this.generateTimelineChart(characterGroups, startDate, endDate);
      }
    } catch (error) {
      logger.error("Error generating ship types chart:", error);
      throw error;
    }
  }

  /**
   * Helper to fetch ship type name from ESI and cache it
   */
  private async getShipTypeName(typeId: string): Promise<string> {
    if (this.shipTypeNameCache[typeId]) return this.shipTypeNameCache[typeId];
    try {
      const resp = await axios.get(
        `https://esi.evetech.net/latest/universe/types/${typeId}/?datasource=tranquility`
      );
      const name = resp.data.name || typeId;
      this.shipTypeNameCache[typeId] = name;
      return name;
    } catch {
      return typeId;
    }
  }

  /**
   * Generate a horizontal bar chart showing top ship types destroyed
   */
  private async generateHorizontalBarChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // Extract all character IDs from the groups
    const characterIds = characterGroups
      .flatMap((group) => group.characters)
      .map((character) => character.eveId);

    if (characterIds.length === 0) {
      throw new Error("No characters found in the provided groups");
    }

    // Get the top ship types data
    const shipTypesData = await this.killRepository.getTopShipTypesDestroyed(
      characterIds,
      startDate,
      endDate,
      15 // Limit to top 15 ship types
    );

    if (shipTypesData.length === 0) {
      throw new Error("No ship type data found for the specified time period");
    }

    // Lookup ship type names for all shipTypeIds
    const shipTypeNames = await Promise.all(
      shipTypesData.map((type) => this.getShipTypeName(type.shipTypeId))
    );

    // Exclude 'Capsule' from the results
    const filtered = shipTypesData
      .map((type, i) => ({ ...type, name: shipTypeNames[i] }))
      .filter((entry) => entry.name.toLowerCase() !== "capsule");

    if (filtered.length === 0) {
      throw new Error(
        "No ship type data found for the specified time period (after filtering capsules)"
      );
    }

    // Sort by count in descending order
    filtered.sort((a, b) => b.count - a.count);

    // Calculate total destroyed
    const totalDestroyed = filtered.reduce(
      (sum, shipType) => sum + shipType.count,
      0
    );

    // Create chart data
    const chartData: ChartData = {
      labels: filtered.map((type) => type.name),
      datasets: [
        {
          label: "Ships Destroyed",
          data: filtered.map((type) => type.count),
          backgroundColor: this.getVisibleColors(
            filtered.map((type) => type.count),
            ShipTypesChartConfig.colors
          ),
          borderColor: ShipTypesChartConfig.colors.map((color) =>
            this.adjustColorBrightness(color, -20)
          ),
        },
      ],
      displayType: "horizontalBar",
      title: `${ShipTypesChartConfig.title} - ${format(
        startDate,
        "MMM d"
      )} to ${format(endDate, "MMM d, yyyy")}`,
      summary: ShipTypesChartConfig.getDefaultSummary(
        filtered.length,
        totalDestroyed
      ),
    };

    return chartData;
  }

  /**
   * Generate a vertical bar chart showing top ship types destroyed
   */
  private async generateVerticalBarChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // This is similar to horizontal bar chart but with a different orientation
    const chartData = await this.generateHorizontalBarChart(
      characterGroups,
      startDate,
      endDate
    );
    chartData.displayType = "bar";
    return chartData;
  }

  /**
   * Generate a timeline chart showing ship types destroyed over time
   */
  private async generateTimelineChart(
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<ChartData> {
    // For now, just show a bar chart (timeline for ship types is less common)
    return this.generateHorizontalBarChart(characterGroups, startDate, endDate);
  }
}
