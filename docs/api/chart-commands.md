# Chart Commands

This document describes the available chart commands and their usage. Our chart system follows a simple, focused approach that prioritizes clarity and usefulness over complexity.

## Current Commands

### Primary Commands

- **`/charts kills [time]`** - Shows a stacked horizontal bar chart by character group displaying total kills and solo kills

  - Optional `time` parameter: `7` (default) or `24` days

- **`/charts map [time]`** - Shows a stacked horizontal bar chart by character group displaying map activities (signatures, anomalies, wormholes)
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

## Future Commands

The following commands are planned for future implementation, all following the same simplified pattern with just an optional time parameter:

### Planned Additions

- **`/charts deaths [time]`** - Shows stacked horizontal bar chart of total deaths vs. solo deaths by character group
- **`/charts ratio [time]`** - Shows horizontal bar chart of kill-to-death ratio per character group
- **`/charts shiptypes [time]`** - Shows horizontal bar chart of top ship types destroyed (by count)
- **`/charts distribution [time]`** - Shows pie chart of solo vs. small-group vs. large-group kills
- **`/charts hourly [time]`** - Shows vertical bar chart of total kills by hour of day
- **`/charts corps [time]`** - Shows horizontal bar chart of total kills per enemy corporation

## Implementation Details

All chart commands follow these principles:

1. **Simplicity** - Each command has at most one optional parameter
2. **Consistency** - All commands work the same way with similar outputs
3. **Group-oriented** - Charts focus on character groups rather than individuals
4. **Clear visualization** - Horizontal bar charts work well for comparing across groups

## Technical Considerations

- Charts are rendered using Chart.js through our ChartRenderer service
- Data is aggregated at the character group level for better readability
- Time windows are limited to 7 or 24 days to ensure reasonable performance
- Charts use a consistent color scheme for easier interpretation
