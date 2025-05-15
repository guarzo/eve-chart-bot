# Chart Bot Architecture Refactoring

## Current Issues

After reviewing the codebase, we've identified several structural challenges that need to be addressed before adding more chart types:

1. **Monolithic Services**: `ChartService.ts` (1435 lines) contains all chart generation logic with limited separation of concerns.
2. **Limited Extensibility**: Adding new chart types currently requires modifying existing, complex files.
3. **Inconsistent Command Structure**: Mixture of legacy command patterns (`/kills`, `/map`) and newer ones (`/charts kills`, `//charts map`).
4. **Tight Coupling**: Chart data generation, rendering, and Discord handling are closely intertwined.

## Proposed Architecture

### Directory Structure

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
│   │   │   │   └── RatioChartConfig.ts
│   │   │   └── generators/         # Individual chart implementations
│   │   │       ├── KillsChartGenerator.ts
│   │   │       ├── MapChartGenerator.ts
│   │   │       ├── LossChartGenerator.ts
│   │   │       └── RatioChartGenerator.ts
│   │   └── ChartRenderer.ts        # Rendering service (mostly unchanged)
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
│   │   │   │       └── RatioHandler.ts
│   │   │   ├── client.ts           # Discord client setup
│   │   │   └── index.ts            # Discord module exports
│   │   └── ...
│   └── types/
│       ├── chart.ts                # Expanded type definitions
│       └── ...
└── ...
```

## Implementation Plan

### ✅ Phase 1: Refactor Data Access Layer (Completed)

1. **✅ Create Base Repository**

   - ✅ Implement common data retrieval methods
   - ✅ Add caching and error handling

2. **✅ Implement Specialized Repositories**
   - ✅ `KillRepository` for kill data
   - ✅ `CharacterRepository` for character data
   - ✅ `MapActivityRepository` for map activity data

### ✅ Phase 2: Refactor Chart Generation System (Completed)

1. **✅ Create Base Chart Generator**

   - ✅ Extract common chart generation code from `ChartService.ts`
   - ✅ Implement shared functionality (colors, formatting, etc.)

2. **✅ Develop Chart Factory**

   - ✅ Create factory pattern to instantiate specific chart generators
   - ✅ Add registry for available chart types

3. **✅ Implement Chart Config System**

   - ✅ Move chart-specific configurations to separate config files
   - ✅ Create standardized interface for chart configs

4. **✅ Create Specialized Chart Generators**
   - ✅ Refactor existing chart logic into separate generator classes
   - ✅ Start with `KillsChartGenerator` and `MapChartGenerator`

### ✅ Phase 3: Refactor Discord Integration (Completed)

1. **✅ Create Command Registry**

   - ✅ Implement registry to map subcommands to handlers
   - ✅ Add validation and help text

2. **✅ Implement Modular Command Handlers**

   - ✅ Create specialized handlers for each chart type
   - ✅ Improve error handling and user feedback

3. **✅ Standardize Command Structure**
   - ✅ Migrate fully to `/charts <type>` pattern
   - ✅ Deprecate legacy commands with warnings

### ✅ Phase 4: Add Loss and Ratio Chart Types (Completed)

1. **✅ Database Schema Updates**

   - ✅ Add `losses_fact` table to Prisma schema
   - ✅ Run database migration
   - ✅ Create test data script

2. **✅ Loss Data Repository**

   - ✅ Implement `LossRepository` with data access methods
   - ✅ Add caching for efficient queries
   - ✅ Create methods for loss summaries by character groups

3. **✅ Chart Generator Implementation**

   - ✅ Create `LossChartGenerator` for ship losses
   - ✅ Create `RatioChartGenerator` for kill-death ratios
   - ✅ Add formatters for ISK values and time ranges

4. **✅ Discord Command Handlers**

   - ✅ Implement `LossHandler` for `/charts loss` command
   - ✅ Implement `RatioHandler` for `/charts ratio` command
   - ✅ Update command registry

5. **✅ Data Ingestion**
   - ✅ Update RedisQ consumer to detect losses of tracked characters
   - ✅ Add loss processing to killmail handling

### 🔄 Phase 5: Implement Additional Chart Types (In Progress)

1. **Ship Types Chart** (`/charts shiptypes`)
2. **Distribution Chart** (`/charts distribution`)
3. **Hourly Activity Chart** (`/charts hourly`)
4. **Corporation Kills Chart** (`/charts corps`)

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
} from "./generators";
import { logger } from "../../lib/logger";

export class ChartFactory {
  private generators: Map<string, new () => BaseChartGenerator> = new Map();

  constructor() {
    this.registerGenerators();
  }

  private registerGenerators(): void {
    this.generators.set("kills", KillsChartGenerator);
    this.generators.set("map_activity", MapChartGenerator);
    this.generators.set("loss", LossChartGenerator);
    this.generators.set("ratio", RatioChartGenerator);
    // Register other generators as they're implemented
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
import { logger } from "../../lib/logger";

export abstract class BaseChartGenerator {
  protected colors: string[] = [
    "#3366CC", // deep blue
    "#DC3912", // red
    "#FF9900", // orange
    // Additional colors...
  ];

  abstract generateChart(options: {
    startDate: Date;
    endDate: Date;
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
    }>;
    displayType: string;
  }): Promise<ChartData>;

  protected getColorForIndex(index: number): string {
    return this.colors[index % this.colors.length];
  }

  protected adjustColorBrightness(hexColor: string, percent: number): string {
    // Implementation from current ChartService
  }

  protected formatValue(value: number): string {
    // Implementation from current ChartService
  }
}
```

### Chart Configuration

```typescript
// services/charts/config/KillsChartConfig.ts
export const KillsChartConfig = {
  title: "Kills by Character Group",
  metrics: [
    { name: "Total Kills", field: "totalKills", color: "#3366CC" },
    { name: "Solo Kills", field: "soloKills", color: "#DC3912" },
  ],
  chartOptions: {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.dataset.label || "";
            const value = context.parsed.x;
            return `${label}: ${value.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: "Count",
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        title: {
          display: true,
          text: "Character Group",
        },
      },
    },
  },
};
```

## Progress Update

### Completed Phases (1-4)

We have successfully implemented the first four phases of our architecture plan:

1. **Data Access Layer**:

   - Created a flexible `BaseRepository` with caching and error handling
   - Implemented specialized repositories for characters, kills, map activity and losses
   - Added proper type definitions for data models

2. **Chart Generation System**:

   - Created a modular `BaseChartGenerator` with common functionality
   - Implemented specialized generators for kills, map activity, losses, and KD ratios
   - Created a chart factory for dynamically selecting generators
   - Added configuration files for different chart types

3. **Discord Integration**:

   - Created command handlers for the new chart system
   - Standardized the command structure to use `/charts <type>` pattern
   - Ensured a smooth transition from the old to the new system

4. **Loss and Ratio Charts**:
   - Added database schema for loss tracking
   - Created repository for accessing loss data
   - Implemented chart generators for losses and kill-death ratios
   - Added data ingestion for capturing losses in real-time

### Current Focus

We're now ready to begin Phase 5 - implementing additional chart types:

- Ship types distribution charts
- Activity distribution charts
- Hourly activity charts
- Corporation performance comparison charts

## Benefits of This Approach

1. **Modularity**: Each chart type is self-contained and can be developed independently
2. **Maintainability**: Smaller, focused files are easier to understand and modify
3. **Extensibility**: Adding new chart types requires minimal changes to existing code
4. **Testability**: Components can be tested in isolation
5. **Consistency**: Standardized patterns for all chart types

## Migration Strategy

1. ✅ Implement new architecture alongside existing code
2. ✅ Convert one chart type at a time, starting with kills and map activity
3. ✅ Add loss tracking capability
4. ✅ Add kill-death ratio analytics
5. 🔄 Implement additional chart types
6. Add comprehensive tests for all components
7. Once all features are migrated, deprecate and remove old implementations

## Next Steps

1. Begin implementing ship types distribution chart type
2. Add hourly activity chart
3. Implement corporation comparison charts
4. Add comprehensive tests for all components
5. Improve documentation with usage examples
