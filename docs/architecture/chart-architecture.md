# Chart Bot Architecture

## Current Architecture

The chart system has been successfully refactored to address the initial structural challenges:

1. ✅ **Modular Services**: Chart generation logic is now split into specialized generators
2. ✅ **Extensible Design**: New chart types can be added by creating new generator classes
3. ✅ **Consistent Command Structure**: All commands follow the `/charts <type>` pattern
4. ✅ **Loose Coupling**: Clear separation between data access, chart generation, and Discord handling

## Directory Structure

```
bot/
├── src/
│   ├── data/                       # Data access layer
│   │   ├── repositories/           # Data access patterns
│   │   │   ├── BaseRepository.ts
│   │   │   ├── KillRepository.ts
│   │   │   ├── CharacterRepository.ts
│   │   │   ├── MapActivityRepository.ts
│   │   │   └── LossRepository.ts
│   │   └── models/                 # Data models
│   │       └── index.ts
│   ├── services/
│   │   ├── charts/                 # Chart generation system
│   │   │   ├── ChartFactory.ts     # Creates appropriate chart generators
│   │   │   ├── BaseChartGenerator.ts  # Common chart functionality
│   │   │   ├── config/             # Chart configurations
│   │   │   │   ├── index.ts        # Export all configs
│   │   │   │   ├── KillsChartConfig.ts
│   │   │   │   ├── MapChartConfig.ts
│   │   │   │   ├── LossChartConfig.ts
│   │   │   │   ├── RatioChartConfig.ts
│   │   │   │   ├── DistributionChartConfig.ts
│   │   │   │   ├── ShipTypesChartConfig.ts
│   │   │   │   ├── HeatmapChartConfig.ts
│   │   │   │   └── TrendChartConfig.ts
│   │   │   └── generators/         # Individual chart implementations
│   │   │       ├── KillsChartGenerator.ts
│   │   │       ├── MapChartGenerator.ts
│   │   │       ├── LossChartGenerator.ts
│   │   │       ├── RatioChartGenerator.ts
│   │   │       ├── DistributionChartGenerator.ts
│   │   │       ├── ShipTypesChartGenerator.ts
│   │   │       ├── HeatmapChartGenerator.ts
│   │   │       └── TrendChartGenerator.ts
│   │   └── ChartRenderer.ts        # Rendering service
│   ├── lib/
│   │   ├── discord/
│   │   │   ├── commands/           # Command definitions
│   │   │   │   ├── registry.ts     # Maps commands to handlers
│   │   │   │   └── ChartsCommand.ts  # Primary command definition
│   │   │   ├── handlers/           # Command handlers
│   │   │   │   ├── ChartsCommandHandler.ts  # Main handler with subcommand routing
│   │   │   │   └── subcommands/
│   │   │   │       ├── KillsHandler.ts
│   │   │   │       ├── MapHandler.ts
│   │   │   │       ├── LossHandler.ts
│   │   │   │       ├── RatioHandler.ts
│   │   │   │       ├── DistributionHandler.ts
│   │   │   │       ├── ShipTypesHandler.ts
│   │   │   │       ├── HeatmapHandler.ts
│   │   │   │       └── TrendHandler.ts
│   │   │   ├── client.ts           # Discord client setup
│   │   │   └── index.ts            # Discord module exports
│   │   └── ...
│   └── types/
│       ├── chart.ts                # Chart type definitions
│       └── ...
└── ...
```

## Implementation Status

### ✅ Phase 1: Data Access Layer (Completed)

- ✅ Base Repository with common data retrieval methods
- ✅ Specialized repositories for kills, characters, map activity, and losses
- ✅ Caching and error handling implemented

### ✅ Phase 2: Chart Generation System (Completed)

- ✅ Base Chart Generator with shared functionality
- ✅ Chart Factory for instantiating generators
- ✅ Standardized chart configuration system
- ✅ Specialized chart generators for all chart types

### ✅ Phase 3: Discord Integration (Completed)

- ✅ Command registry for subcommand mapping
- ✅ Modular command handlers for each chart type
- ✅ Standardized `/charts <type>` command pattern
- ✅ Improved error handling and user feedback

### ✅ Phase 4: Core Chart Types (Completed)

- ✅ Kills and Map Activity charts
- ✅ Losses and Ratio charts
- ✅ Distribution and Ship Types charts
- ✅ Heatmap and Trend charts

### 🔄 Phase 5: Future Enhancements (Planned)

1. **Performance Optimization**

   - Implement query result caching
   - Add batch processing for large datasets
   - Optimize chart rendering for large datasets

2. **Additional Features**

   - Add support for custom time ranges
   - Implement chart comparison features
   - Add export functionality for chart data

3. **UI Improvements**
   - Add interactive chart elements
   - Implement zoom and pan controls
   - Add more detailed tooltips

## Code Examples

### Chart Factory

```typescript
// services/charts/ChartFactory.ts
import { BaseChartGenerator } from "./BaseChartGenerator";
import {
  KillsChartGenerator,
  MapChartGenerator,
  LossChartGenerator,
  RatioChartGenerator,
  DistributionChartGenerator,
  ShipTypesChartGenerator,
  HeatmapChartGenerator,
  TrendChartGenerator,
} from "./generators";

export class ChartFactory {
  private generators: Map<string, new () => BaseChartGenerator> = new Map();

  constructor() {
    this.registerGenerators();
  }

  private registerGenerators(): void {
    this.generators.set("kills", KillsChartGenerator);
    this.generators.set("map", MapChartGenerator);
    this.generators.set("losses", LossChartGenerator);
    this.generators.set("ratio", RatioChartGenerator);
    this.generators.set("distribution", DistributionChartGenerator);
    this.generators.set("shiptypes", ShipTypesChartGenerator);
    this.generators.set("heatmap", HeatmapChartGenerator);
    this.generators.set("trend", TrendChartGenerator);
  }

  public getGenerator(chartType: string): BaseChartGenerator {
    const GeneratorClass = this.generators.get(chartType);
    if (!GeneratorClass) {
      throw new Error(`Unknown chart type: ${chartType}`);
    }
    return new GeneratorClass();
  }

  public getAvailableChartTypes(): string[] {
    return Array.from(this.generators.keys());
  }
}
```

### Base Chart Generator

```typescript
// services/charts/BaseChartGenerator.ts
import { ChartData, ChartOptions } from "../../types/chart";
import { getThemeSettings, getThemeColors } from "./config/theme";

export abstract class BaseChartGenerator {
  protected abstract generateChartData(options: {
    startDate: Date;
    endDate: Date;
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>;
  }): Promise<ChartData>;

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
          position: "top",
          labels: {
            usePointStyle: true,
            color: getThemeSettings().text,
          },
        },
        tooltip: {
          mode: "index",
          intersect: false,
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Time",
            color: getThemeSettings().text,
          },
          grid: {
            color: getThemeSettings().grid,
          },
          ticks: {
            color: getThemeSettings().text,
          },
        },
        y: {
          title: {
            display: true,
            text: "Value",
            color: getThemeSettings().text,
          },
          grid: {
            color: getThemeSettings().grid,
          },
          ticks: {
            color: getThemeSettings().text,
          },
        },
      },
    };
  }
}
```
