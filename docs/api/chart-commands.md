# Chart Commands

This document describes the available chart commands and their usage. Our chart system follows a simple, focused approach that prioritizes clarity and usefulness over complexity.

## Current Commands

### Primary Commands

- **`/charts kills [time]`** - Shows a stacked horizontal bar chart by character group displaying total kills and solo kills

  - Optional `time` parameter: `7` (default) or `24` days

- **`/charts map [time]`** - Shows a stacked horizontal bar chart by character group displaying map activities (signatures, anomalies, wormholes)

  - Optional `time` parameter: `7` (default) or `24` days

- **`/charts losses [time]`** - Shows a dual-axis chart with total losses (bars) and ISK lost (line) by character group

  - Optional `time` parameter: `7` (default) or `24` days

- **`/charts ratio [time]`** - Shows a gauge chart displaying kill-to-death ratio and efficiency metrics

  - Optional `time` parameter: `7` (default) or `24` days

- **`/charts shiptypes [time]`** - Shows a horizontal bar chart of top ship types destroyed (by count)

  - Optional `time` parameter: `7` (default) or `24` days

- **`/charts distribution [time]`** - Shows a box plot and violin chart of attacker group size distribution

  - Optional `time` parameter: `7` (default) or `24` days

- **`/charts heatmap [time]`** - Shows a 7×24 heatmap of kill activity by hour and day of week

  - Optional `time` parameter: `7` (default) or `24` days

- **`/charts trend [time]`** - Shows a time-series line chart of kill activity over time

  - Optional `time` parameter: `7` (default) or `24` days

- **`/charts corps [time]`** - Shows a horizontal bar chart of total kills per enemy corporation
  - Optional `time` parameter: `7` (default) or `24` days

## Example Output

### `/charts kills`

Shows kill activity for each character group over the past 7 days, with each bar broken down into:

- Total kills (blue)
- Solo kills (red)

The chart includes a summary of total kills and percentage of solo kills across all groups.

### `/charts map`

Shows map activity for each character group over the past 7 days, with each bar broken down into:

- Signatures (blue)
- Cosmic Anomalies (red)
- Wormholes (yellow)

### `/charts losses`

Shows loss activity for each character group over the past 7 days, with:

- Total losses as bars on the left axis
- ISK lost (in billions) as a line on the right axis

### `/charts ratio`

Shows performance metrics for each character group:

- K/D ratio displayed as a gauge chart
- Efficiency percentage shown as a bullet chart

## Implementation Details

All chart commands follow these principles:

1. **Simplicity** - Each command has at most one optional parameter
2. **Consistency** - All commands work the same way with similar outputs
3. **Group-oriented** - Charts focus on character groups rather than individuals
4. **Clear visualization** - Uses appropriate chart types for different data types:
   - Horizontal bars for comparing across groups
   - Dual-axis charts for related metrics
   - Heatmaps for time-of-day patterns
   - Box plots for distributions
   - Gauges for ratios

## Technical Considerations

- Charts are rendered using Chart.js through our ChartRenderer service
- Data is aggregated at the character group level for better readability
- Time windows are limited to 7 or 24 days to ensure reasonable performance
- Charts use a consistent color scheme for easier interpretation
- Dark mode support is built-in with appropriate contrast
- All charts are responsive and maintain aspect ratio
- Tooltips provide detailed information on hover
