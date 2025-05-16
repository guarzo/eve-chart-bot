import { ChartData, ChartOptions } from "../../types/chart";
import { logger } from "../../lib/logger";
import { chartPalette } from "./config/theme";

/**
 * Base class for all chart generators
 * Provides common functionality for generating charts
 */
export abstract class BaseChartGenerator {
  protected colors: string[] = chartPalette;

  /**
   * Generate chart data based on input options
   * This method must be implemented by all chart generators
   */
  abstract generateChart(options: {
    startDate: Date;
    endDate: Date;
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{
        eveId: string;
        name: string;
        mainCharacterId?: string;
      }>;
      mainCharacterId?: string;
    }>;
    displayType: string;
  }): Promise<ChartData>;

  /**
   * Get color for a specific index (cycles through the color array)
   */
  protected getColorForIndex(index: number): string {
    return this.colors[index % this.colors.length];
  }

  /**
   * Adjust the brightness of a color by a percentage
   * @param hexColor Hex color string (e.g., "#FFFFFF")
   * @param percent Percentage to adjust (-100 to 100)
   */
  protected adjustColorBrightness(hexColor: string, percent: number): string {
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const adjustValue = (value: number): number => {
      const adjustedValue = value * (1 + percent / 100);
      return Math.min(255, Math.max(0, Math.round(adjustedValue)));
    };

    const rr = adjustValue(r).toString(16).padStart(2, "0");
    const gg = adjustValue(g).toString(16).padStart(2, "0");
    const bb = adjustValue(b).toString(16).padStart(2, "0");

    return `#${rr}${gg}${bb}`;
  }

  /**
   * Format value for readability (e.g., 1000 -> 1K)
   */
  protected formatValue(value: number): string {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    } else if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    } else if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    } else {
      return value.toString();
    }
  }

  /**
   * Format BigInt value for readability
   */
  protected formatBigIntValue(value: bigint): string {
    const valueStr = value.toString();
    const valueNum = Number(valueStr);
    return this.formatValue(valueNum);
  }

  /**
   * Get format string for a time group (hour, day, week)
   */
  protected getGroupByFormat(groupBy: "hour" | "day" | "week"): string {
    switch (groupBy) {
      case "hour":
        return "HH:mm";
      case "week":
        return "MMM dd";
      case "day":
      default:
        return "MMM dd";
    }
  }

  /**
   * Get a date format based on the group by setting
   */
  protected getDateFormat(groupBy: "hour" | "day" | "week"): string {
    switch (groupBy) {
      case "hour":
        return "yyyy-MM-dd HH:mm";
      case "week":
        return "yyyy-MM-dd 'week'";
      case "day":
      default:
        return "yyyy-MM-dd";
    }
  }

  /**
   * Generate a random color
   */
  protected getRandomColor(): string {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  /**
   * Create default chart options
   */
  protected getDefaultOptions(title: string): ChartOptions {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: title,
          font: {
            size: 16,
            weight: "bold",
          },
        },
        legend: {
          display: true,
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const label = context.dataset.label || "";
              const value =
                context.parsed.y !== undefined
                  ? context.parsed.y
                  : context.parsed;
              return `${label}: ${value.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Time",
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Value",
          },
        },
      },
    };
  }

  // Add additional utility functions for consistent color handling
  protected getStandardColor(index: number, opacity: number = 1): string {
    const hexColor = this.colors[index % this.colors.length];
    if (opacity === 1) return hexColor;

    // Convert hex to rgba for opacity
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  /**
   * Get display name for a character group
   * Prioritizes main character name if available
   */
  protected getGroupDisplayName(group: {
    name: string;
    characters: Array<{ eveId: string; name: string }>;
    mainCharacterId?: string;
  }): string {
    // Debug log: print group info
    const charList = group.characters
      .map((c) => `${c.eveId}:${c.name}`)
      .join(", ");
    // eslint-disable-next-line no-console
    console.log(
      `[getGroupDisplayName] group: ${group.name}, mainCharacterId: ${group.mainCharacterId}, characters: [${charList}]`
    );
    if (group.mainCharacterId) {
      const main = group.characters.find(
        (c) => c.eveId === group.mainCharacterId
      );
      if (main) {
        // eslint-disable-next-line no-console
        console.log(
          `[getGroupDisplayName] Returning main character name: ${main.name}`
        );
        return main.name;
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `[getGroupDisplayName] mainCharacterId ${group.mainCharacterId} not found in characters.`
        );
      }
    }
    if (group.characters.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[getGroupDisplayName] Returning first character name: ${group.characters[0].name}`
      );
      return group.characters[0].name;
    }
    // eslint-disable-next-line no-console
    console.log(`[getGroupDisplayName] Returning group name: ${group.name}`);
    return group.name;
  }

  /**
   * Get dataset colors for a specific chart type
   */
  protected getDatasetColors(type: string): {
    primary: string;
    secondary: string;
  } {
    switch (type) {
      case "kills":
        return {
          primary: this.colors[0],
          secondary: this.colors[1],
        };
      case "loss":
        return {
          primary: this.colors[2],
          secondary: this.colors[3],
        };
      case "map":
        return {
          primary: this.colors[4],
          secondary: this.colors[5],
        };
      default:
        return {
          primary: this.colors[0],
          secondary: this.colors[1],
        };
    }
  }

  // Helper to make lower-value bars more visible by ensuring brightness
  protected getVisibleColors(values: number[], colorSet: string[]): string[] {
    return values.map((value, i) => {
      // For low values, increase brightness to ensure visibility
      if (value > 0 && value < 5) {
        return this.adjustColorBrightness(colorSet[i % colorSet.length], 20);
      }
      return colorSet[i % colorSet.length];
    });
  }
}
