# Chart Code Consolidation Migration Guide

This guide explains how to migrate from the scattered chart implementation to the consolidated analytics bounded context.

## Overview

The chart-related code has been consolidated from multiple locations into a single, well-organized analytics bounded context following Domain-Driven Design principles.

### Before (Scattered Implementation)

```
src/
├── application/chart/         # Rendering strategies, pipelines
├── services/charts/          # Generators, configs, implementations
├── services/ChartService.ts  # Monolithic service (1492 lines)
└── lib/discord/handlers/     # Direct dependencies on chart services
```

### After (Consolidated Implementation)

```
src/bounded-contexts/analytics/
├── domain/                   # Pure business logic
│   ├── value-objects/       # ChartConfiguration, ChartData
│   └── services/            # Data processors
├── application/             # Use cases and orchestration
│   └── services/           # UnifiedChartService
└── infrastructure/         # External dependencies
    ├── rendering/         # Chart.js implementation
    ├── repositories/     # Data access
    └── adapters/        # Legacy compatibility
```

## Migration Steps

### Step 1: Update Dependencies

Replace direct imports of scattered chart services:

```typescript
// Before
import { ChartService } from '../services/ChartService';
import { ChartFactory } from '../services/charts/ChartFactory';
import { KillsChartGenerator } from '../services/charts/generators/KillsChartGenerator';

// After
import { createChartService } from '../bounded-contexts/analytics/infrastructure/ConsolidatedChartFactory';
```

### Step 2: Update Service Creation

Replace service instantiation:

```typescript
// Before
const chartService = new ChartService(repoManager);
const generator = new KillsChartGenerator(repoManager);

// After
const chartService = createChartService(prisma, redis);
```

### Step 3: Update Method Calls

The new service uses a configuration-based approach:

```typescript
// Before
const chart = await chartService.generateKillsChart({
  startDate,
  endDate,
  characterGroups,
  displayType: 'horizontalBar'
});

// After
import { ChartConfiguration, ChartType } from '../bounded-contexts/analytics';

const config = new ChartConfiguration(
  ChartType.KILLS,
  TimePeriod.DAY,
  characterIds,
  startDate,
  endDate
);

const result = await chartService.generateChart(config);
if (result.success) {
  const chart = result.data;
}
```

### Step 4: Update Discord Handlers

For Discord command handlers, use the legacy adapter during transition:

```typescript
// In BaseChartHandler.ts
import { createLegacyChartService } from '../bounded-contexts/analytics/infrastructure/ConsolidatedChartFactory';

export abstract class BaseChartHandler {
  protected chartService: any;

  constructor() {
    this.chartService = createLegacyChartService(prisma, redis);
  }
}
```

## Feature Mapping

### Chart Types

| Old Generator | New Chart Type | Data Processor |
|--------------|----------------|----------------|
| KillsChartGenerator | ChartType.KILLS | KillsDataProcessor |
| LossChartGenerator | ChartType.LOSSES | LossDataProcessor |
| EfficiencyChartGenerator | ChartType.EFFICIENCY | EfficiencyDataProcessor |
| HeatmapChartGenerator | ChartType.HEATMAP | HeatmapDataProcessor |
| ShipTypesChartGenerator | ChartType.SHIP_TYPES | ShipTypesDataProcessor |

### Configuration Options

| Old Option | New Configuration Property |
|-----------|---------------------------|
| displayType | Handled by renderer based on ChartType |
| timeRange | config.timePeriod |
| characterGroups | config.characterIds (flattened) |
| showLegend | config.displayOptions.showLegend |

## Benefits of Consolidation

1. **Single Source of Truth**: All chart logic in one bounded context
2. **Clear Separation**: Domain logic separate from rendering
3. **Better Testing**: Each layer can be tested independently
4. **Improved Performance**: Unified caching strategy
5. **Easier Maintenance**: Clear boundaries and responsibilities

## Gradual Migration Strategy

### Phase 1: Setup (Week 1)
- [x] Create DDD structure
- [x] Implement core services
- [x] Create legacy adapters

### Phase 2: Migration (Week 2-3)
- [ ] Update Discord handlers to use legacy adapter
- [ ] Migrate chart generators to processors
- [ ] Update caching implementation

### Phase 3: Optimization (Week 4)
- [ ] Remove duplicate code
- [ ] Optimize rendering strategies
- [ ] Update all tests

### Phase 4: Cleanup (Week 5)
- [ ] Remove old directories
- [ ] Update documentation
- [ ] Final testing

## Common Issues and Solutions

### Issue: Chart rendering differences
**Solution**: The new renderer uses the same Chart.js library but with cleaner configuration. Visual output should be identical.

### Issue: Performance degradation
**Solution**: The unified caching strategy should improve performance. Monitor cache hit rates.

### Issue: Missing chart types
**Solution**: Add new processors in `domain/services/processors/` following the existing pattern.

## Testing

Run the test suite to ensure compatibility:

```bash
# Unit tests for domain logic
npm test -- tests/unit/bounded-contexts/analytics/domain

# Integration tests for chart generation
npm test -- tests/integration/analytics

# End-to-end Discord command tests
npm test -- tests/e2e/discord-charts
```

## Support

For questions or issues during migration:
1. Check this migration guide
2. Review the analytics bounded context README
3. Look at the example implementations in test files