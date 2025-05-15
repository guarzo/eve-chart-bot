# Chart Commands

This document describes the available chart commands and their usage. Our chart system follows a simple, focused approach that prioritizes clarity and usefulness over complexity.

## Current Commands

### Primary Commands

- **`/charts kills [time]`** - Shows a stacked horizontal bar chart by character group displaying total kills and solo kills

  - Optional `time` parameter: `7` (default) or `24` days

- **`/charts map [time]`** - Shows a stacked horizontal bar chart by character group displaying map activities

  - Optional `time` parameter: `7` (default) or `24` days

- **`/charts loss [time]`** - Shows a stacked horizontal bar chart of total losses and high-value losses by character group

  - Optional `time` parameter: `7` (default) or `24` days

- **`/charts ratio [time]`** - Shows horizontal bar chart of kill-to-death ratio per character group

  - Optional `time` parameter: `7` (default) or `24` days

- **`/charts list`** - Shows a list of all available chart commands

## Example Output

### `/charts kills`

Shows kill activity for each character group over the past 7 days, with each bar broken down into:

- Total kills (blue)
- Solo kills (red)

The chart includes a summary of total kills and percentage of solo kills across all groups.

### `/charts map`

Shows map activity for each character group over the past 7 days, with each bar showing:

- Systems Visited (blue)
- Signatures Scanned (green)

### `/charts loss`

Shows ship losses for each character group over the past 7 days, with each bar showing:

- Total Losses (red)
- High Value Losses (orange)

The chart includes a summary of total losses and the total ISK value lost.

### `/charts ratio`

Shows kill-to-death ratio for each character group over the past 7 days as a horizontal bar chart. Higher ratios indicate more efficient PVP performance.

## Upcoming Commands

The following commands are planned for future implementation, all following the same simplified pattern with just an optional time parameter:

### Basic Chart Commands

- **`/charts shiptypes [time]`** - Shows horizontal bar chart of top ship types destroyed (by count)
- **`/charts distribution [time]`** - Shows pie chart of solo vs. small-group vs. large-group kills
- **`/charts corps [time]`** - Shows horizontal bar chart of total kills per enemy corporation
- **`/charts trend [time]`** - Shows line chart of kills over time
- **`/charts heatmap [time]`** - Shows heatmap of kill activity by hour and day of week
- **`/charts shipusage [time]`** - Shows stacked horizontal bar of kills by ship type used
- **`/charts fleet [time]`** - Shows dual-axis chart of fleet activity (size and value)
- **`/charts value [time]`** - Shows histogram and box plots of kill values distribution

### Advanced Visualization Options

Each chart will offer multiple visualization options for deeper insights:

- **Kills Chart**:
  - Stacked bars (solo kills on top of other kills)
  - Time series option showing trends
- **Loss Chart**:
  - Area chart for cumulative ISK lost over time
  - Dot plot for high-value loss spikes
- **Map Activity**:
  - Dual-axis line chart (systems vs. signatures)
  - Scatter plot to identify efficiency outliers
- **Ratio Chart**:
  - Bubble chart (K/D ratio vs. efficiency %)
  - Radar chart for multidimensional visualization

### Integrated Dashboard

- **`/charts dashboard [time]`** - Shows a comprehensive dashboard with multiple metrics
  - A combined view with:
    - Time-series chart of kills vs. losses
    - Per-group trend sparklines
    - Interactive visualization of key metrics
    - Distribution analysis panels

### Scheduled Chart Delivery

Coming soon! Automatic delivery of charts to designated Discord channels:

- **`/charts schedule add [channel] [type] [time]`** - Schedule a chart to be posted regularly
- **`/charts schedule list`** - List all scheduled chart deliveries
- **`/charts schedule remove [id]`** - Remove a scheduled chart delivery

These commands will allow server administrators to set up daily or weekly chart postings to keep members informed of alliance activities automatically.

## Implementation Details

All chart commands follow these principles:

1. **Simplicity** - Each command has at most one optional parameter
2. **Consistency** - All commands work the same way with similar outputs and color schemes
3. **Group-oriented** - Charts focus on character groups rather than individuals
4. **Clear visualization** - Charts use appropriate visualization types for the data

## Chart Display Features

All charts include the following features:

- **Consistent color schemes** with high-contrast, colorblind-safe palettes
- **Enhanced visibility** for low-value data points
- **Interactive tooltips** when viewing in Discord (on hover)
- **Summary statistics** displayed with each chart
- **Clean, readable layout** with proper spacing and scaling
- **Annotation capabilities** like threshold lines and markers
- **Automatic filtering** of character groups with no data
- **Proper axis formatting** with appropriate scales and labels

## Technical Considerations

- Charts are rendered using Chart.js through our ChartRenderer service
- Data is aggregated at the character group level for better readability
- Time windows are limited to 7 or 24 days to ensure reasonable performance
- Charts use consistent color schemes for easier interpretation
- Low-volume data sources are visually enhanced to ensure visibility
- Accessibility features include colorblind-safe palettes and text alternatives
