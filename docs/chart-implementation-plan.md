# Chart Implementation Plan

This document outlines the plan for implementing the remaining chart types mentioned in the chart-commands.md documentation.

## Current Status

We have successfully implemented the following chart commands:

- `/charts kills [time]`
- `/charts map [time]`
- `/charts loss [time]`
- `/charts ratio [time]`
- `/charts list`
- `/charts shiptypes [time]` ✅
- `/charts distribution [time]` ✅
- `/charts corps [time]` ✅

## Implementation Roadmap

We'll implement the remaining chart types in the following phases:

### Phase 1: Visual Enhancements & Baseline Improvements

**Target Completion: 2 weeks**

- **General Styling & UX Enhancements**
  - Implementation:
    - Update BaseChartGenerator with consistent, high-contrast palette (4-6 colors that are colorblind-safe)
    - Add option to filter out character groups with no data
    - Use lighter background grids and darker lines/text for better contrast
    - Implement auto-rotation or wrapping for long character names
    - Add annotation capability for thresholds (e.g., average K/D ratio lines)
    - Create templates for standard chart patterns
- **Current Chart Improvements**

  - Kills chart:

    - Option for stacked bars (solo kills on top of other kills) rather than side-by-side
    - Add time series option showing trends over the selected period

  - Loss chart:

    - Add area chart option for cumulative ISK lost
    - Add dot plot option for high-value loss spikes

  - Map activity:

    - Add dual-axis option (systems on left, signatures on right)
    - Add scatter plot option (systems vs. signatures)

  - K/D ratio:
    - Add bubble chart option (K/D ratio vs. efficiency percentage)
    - Add radar chart option for multidimensional visualization

### Phase 2: Ship Type Analysis

**Target Completion: 3 weeks**

- **`/charts shiptypes [time]`** - Shows horizontal bar chart of top ship types destroyed (by count) ✅
  - Data Source: KillFact.shipTypeId from the database ✅
  - Implementation:
    - Create ShipTypesChartConfig.ts with consistent structure ✅
    - Create ShipTypesChartGenerator.ts extending BaseChartGenerator ✅
    - Create ShipTypesHandler.ts extending BaseChartHandler ✅
    - Register in ChartCommandRegistry ✅
    - Update Discord command definition ✅
  - Enhanced Display Options:
    - Pareto chart showing ship-type kill counts with cumulative percentage line
    - Histogram of ship types by ISK value distribution

### Phase 3: Distribution and Enemy Analysis

**Target Completion: 4 weeks**

- **`/charts distribution [time]`** - Shows pie chart of solo vs. small-group vs. large-group kills ✅

  - Data Source: KillFact.attackerCount to categorize kills ✅
  - Implementation:
    - Create DistributionChartConfig.ts with pie chart configuration ✅
    - Create DistributionChartGenerator.ts with pie chart rendering ✅
    - Create DistributionHandler.ts ✅
    - Register in ChartCommandRegistry ✅

- **`/charts corps [time]`** - Shows horizontal bar chart of top enemy corporations ✅
  - Data Source: KillFact.attackers JSON field containing corp info ✅
  - Implementation:
    - Create CorpsChartConfig.ts ✅
    - Create CorpsChartGenerator.ts to extract and aggregate corporation data ✅
    - Create CorpsHandler.ts ✅
    - Register in ChartCommandRegistry ✅
  - Enhanced Display Options:
    - Network graph of alliances (nodes=alliances, edges weighted by kills between them)
    - Interactive filtering by corporation/alliance

### Phase 4: Time-Based Analysis

**Target Completion: 5 weeks**

- **`/charts trend [time]`** - Shows line chart of kills over time ✅

  - Data Source: KillFact.killTime ✅
  - Implementation:
    - Create TrendChartConfig.ts with timeline options ✅
    - Create TrendChartGenerator.ts with time series processing ✅
    - Create TrendHandler.ts ✅
    - Register in ChartCommandRegistry ✅
  - Enhanced Display Options:
    - Dual line chart showing kills vs. losses over time ✅
    - Sparklines for compact trend visualization

- **`/charts heatmap [time]`** - Shows heatmap of kill activity by hour and day of week ✅
  - Data Source: KillFact.killTime to extract hour/day patterns ✅
  - Implementation:
    - Create HeatmapChartConfig.ts for specialized heatmap layout ✅
    - Create HeatmapChartGenerator.ts to transform time data into a matrix ✅
    - Create HeatmapHandler.ts ✅
    - Register in ChartCommandRegistry ✅
  - Enhanced Display Options:
    - Calendar-style heatmap showing activity patterns ✅
    - Time-of-day effectiveness analysis ✅

### Phase 5: Advanced Analysis

**Target Completion: 6 weeks**

- **`/charts shipusage [time]`** - Shows stacked horizontal bar of kills by ship type used

  - Data Source: KillFact.attackers to determine which ships our groups use
  - Implementation:
    - Create ShipUsageChartConfig.ts
    - Create ShipUsageChartGenerator.ts to extract ship types from attackers
    - Create ShipUsageHandler.ts
    - Register in ChartCommandRegistry

- **`/charts fleet [time]`** - Shows dual-axis chart of fleet activity over time

  - Data Source: KillFact.attackerCount and KillFact.totalValue
  - Implementation:
    - Create FleetChartConfig.ts with dual-axis configuration
    - Create FleetChartGenerator.ts with multi-metric analysis
    - Create FleetHandler.ts
    - Register in ChartCommandRegistry

- **`/charts value [time]`** - Shows distribution of kill values
  - Data Source: KillFact.totalValue
  - Implementation:
    - Create ValueChartConfig.ts
    - Create ValueChartGenerator.ts
    - Create ValueHandler.ts
    - Register in ChartCommandRegistry
  - Enhanced Display Options:
    - Histogram of kill ISK values in bins
    - Box-and-whisker plots for showing median, quartiles, and outliers

### Phase 6: Scheduled Chart Delivery

**Target Completion: 3 weeks after Phase 5**

- **Daily Summary Charts** - Automatically post selected charts to designated Discord channels on a schedule

  - Implementation:

    - Create ScheduleService to manage timed chart generation
    - Add configuration options for:
      - Which channels receive which charts
      - Delivery times (configurable per channel)
      - Chart types to include in daily summaries
    - Create admin commands for managing scheduled deliveries:
      - `/charts schedule add [channel] [type] [time]` - Add scheduled chart
      - `/charts schedule list` - View all scheduled charts
      - `/charts schedule remove [id]` - Remove a scheduled chart

  - Features:

    - Automatic daily/weekly activity summaries
    - Performance comparisons against previous periods
    - Highlight exceptional activity (high kill counts, major losses)
    - Weekly leaderboards for various metrics
    - Optional text analysis summarizing the data

  - Technical components:
    - Job scheduler (using node-cron)
    - Persistent schedule storage
    - Channel-specific rendering settings
    - Error handling and retry mechanisms

### Phase 7: Integrated Dashboard Experience

**Target Completion: 8 weeks after Phase 6**

- **Cumulative Dashboard** - Create a combined view of multiple metrics

  - Implementation:

    - Create DashboardChartConfig.ts
    - Create DashboardGenerator.ts to combine multiple charts
    - Create DashboardHandler.ts
    - Register in ChartCommandRegistry

  - Features:
    - Combined layout with:
      - Row 1: Big time-series line chart of total kills vs losses
      - Row 2: Small multiples of per-group trends (K/D ratio sparklines)
      - Row 3: Interactive scatter/bubble plots for signature vs system scan rates
      - Row 4: Distribution panels (histogram, boxplot, ship-type Pareto)
    - Interactive filtering across all panels
    - Hover-to-highlight data across related charts
    - Export to PDF or image formats

## Technical Improvements

In parallel with the new chart implementations, we'll make the following improvements:

1. **Color Consistency**

   - Implement the 4-6 color high-contrast palette from chartideas.md
   - Standardize color usage across chart types
   - Add colorblind-safe palettes
   - Ensure dark mode compatibility with proper contrast

2. **Performance Optimization**

   - Add caching for frequently requested charts
   - Optimize database queries for better performance
   - Add filtering capabilities for large data sets
   - Implement progressive loading for complex dashboards

3. **Visual Improvements**

   - Increase chart size for better readability
   - Add annotations and threshold lines
   - Improve axis formatting with time scales
   - Auto-rotate or wrap long character names
   - Use proper spacing and padding for better visual distinction

4. **Accessibility**
   - Add high-contrast modes
   - Ensure colorblind-friendly palettes
   - Provide text alternatives for chart data
   - Add keyboard navigation for interactive elements

## Implementation Guidelines

All new chart types will follow these guidelines:

1. **Use the established pattern** for chart generators, configs, and handlers
2. **Leverage the BaseChartGenerator** utility functions for consistency
3. **Implement all chart orientations** (horizontal, vertical, timeline) where it makes sense
4. **Include meaningful summaries** with each chart
5. **Handle edge cases gracefully** (empty data, single data point, outliers)
6. **Filter out character groups with no data** by default
7. **Write tests** for each new chart type
8. **Document usage** in chart-commands.md

## Testing Strategy

Each new chart type will be thoroughly tested:

1. **Unit tests** for data transformation logic
2. **Visual inspection** of chart outputs
3. **Performance testing** with large datasets
4. **Edge case testing** for unusual data patterns
5. **Integration testing** with Discord commands
6. **Accessibility testing** for color contrast and screen reader compatibility

## Rollout Strategy

We'll roll out new chart types incrementally:

1. **Development** - Implement the chart type
2. **Internal testing** - Test with internal users
3. **Beta release** - Make available to select users
4. **Documentation** - Update docs and add examples
5. **Full release** - Announce to all users
