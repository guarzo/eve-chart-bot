# EVE Chart Bot Chart Architecture

## Overview

The chart system is built using a factory pattern with specialized generators for different types of charts. Each chart type has its own generator class that extends the base chart generator, providing specific functionality for that chart type.

## Core Components

### Base Chart Generator

- Abstract base class that all chart generators extend
- Provides common functionality:
  - Color management
  - Repository access
  - Common utility methods
- Defines the interface for chart generation

### Chart Factory

- Central factory for creating chart generators
- Manages chart type registration
- Handles color palette configuration
- Provides type-specific color schemes

### Chart Types

1. **Kill Charts**

   - Shows kill statistics
   - Displays total kills, value, and points
   - Supports multiple display types (bar, line, area)

2. **Loss Charts**

   - Shows loss statistics
   - Displays total losses and value lost
   - Includes high-value loss tracking

3. **Efficiency Charts**

   - Shows kill/loss ratio
   - Calculates efficiency percentage
   - Displays total kills and losses

4. **Map Activity Charts**

   - Shows wormhole activity
   - Tracks signatures, connections, and passages
   - Supports time-based grouping

5. **Ship Type Charts**

   - Shows ship type distribution
   - Tracks most destroyed ship types
   - Includes value and count metrics

6. **Trend Charts**

   - Shows activity over time
   - Supports multiple display types:
     - Area charts
     - Dual-axis charts
     - Timeline charts

7. **Heatmap Charts**
   - Shows activity by time of day
   - Visualizes peak activity periods
   - Supports multiple metrics

## Data Flow

1. **Data Retrieval**

   - Each generator uses repository managers to fetch data
   - Data is filtered by date range and character groups
   - Supports pagination and caching

2. **Data Processing**

   - Raw data is transformed into chart-friendly format
   - Calculations are performed (totals, averages, etc.)
   - Data is grouped and sorted as needed

3. **Chart Generation**
   - Processed data is formatted for chart display
   - Colors and styles are applied
   - Chart options are configured

## Configuration

### Color Palettes

- Default palette for all charts
- Type-specific palettes for different chart types
- Support for custom color schemes

### Chart Options

- Display type configuration
- Axis configuration
- Legend settings
- Tooltip formatting

## Chart Types and Their Features

### Kill Charts

- Total kills
- ISK value
- Points
- Attacker count
- Solo kills
- NPC kills

### Loss Charts

- Total losses
- ISK value lost
- High-value losses
- Ship type distribution
- System distribution

### Efficiency Charts

- Kill/Loss ratio
- Efficiency percentage
- Total activity
- Group comparison

### Map Activity Charts

- Signature count
- Connection count
- Passage count
- Time-based activity

### Ship Type Charts

- Most destroyed ships
- Value by ship type
- Count by ship type
- Group comparison

### Trend Charts

- Activity over time
- Multiple metrics
- Group comparison
- Time period selection

### Heatmap Charts

- Activity by hour
- Activity by day
- Peak period identification
- Multiple metrics

## Usage

### Basic Chart Generation

```typescript
const chartFactory = new ChartFactory();
const generator = chartFactory.createGenerator('kills');
const chartData = await generator.generateChart({
  startDate: new Date(),
  endDate: new Date(),
  characterGroups: [...],
  displayType: 'bar'
});
```

### Chart Configuration

```typescript
const config = {
  type: 'kills',
  characterIds: [...],
  period: '7d',
  groupBy: 'hour',
  displayType: 'line',
  displayMetric: 'value',
  limit: 10
};
```

## Error Handling

- Graceful error handling for data retrieval
- Fallback options for missing data
- Detailed error logging
- Retry mechanisms for failed requests

## Performance Considerations

- Data caching
- Efficient data processing
- Pagination for large datasets
- Rate limiting for API calls
