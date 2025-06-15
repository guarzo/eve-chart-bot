# Domain-Driven Design Architecture

This directory contains the EVE Online Discord Bot restructured according to Domain-Driven Design (DDD) principles.

## Architecture Overview

The application is organized into **Bounded Contexts** representing distinct business domains, with a **Shared Kernel** for common functionality.

```
src/
├── shared/                    # Shared Kernel - Common utilities and types
├── bounded-contexts/          # Business domains
│   ├── analytics/            # Chart generation and data visualization
│   ├── kill-tracking/        # Kill/Loss data management
│   ├── character-management/ # Character and group management
│   └── map-activity/         # EVE map activity tracking
└── [legacy directories]      # Original structure (being phased out)
```

## Bounded Contexts

### 1. Analytics Context
**Domain**: Chart generation, data visualization, and analytics

**Responsibilities**:
- Generate kills/losses/efficiency charts
- Process time-series data for visualization
- Cache chart data for performance
- Render charts in various formats

**Key Components**:
- `ChartConfiguration` - Value object for chart parameters
- `ChartData` - Value object for processed chart data  
- `ChartDataProcessor` - Domain service for data aggregation
- `GenerateChartUseCase` - Application orchestration

### 2. Kill Tracking Context
**Domain**: EVE Online killmail and loss data

**Responsibilities**:
- Track killmails and loss data
- Manage kill facts and statistics
- Handle attacker/victim relationships

**Key Components**:
- `KillFact` - Kill event entity
- `LossFact` - Loss event entity
- `Killmail` - Complete killmail data

### 3. Character Management Context
**Domain**: EVE Online characters and groups

**Responsibilities**:
- Manage character data and relationships
- Handle character groups and affiliations
- Track character activity and metadata

**Key Components**:
- `Character` - Character entity
- `CharacterGroup` - Group aggregate

## Layer Architecture

Each bounded context follows a clean 4-layer architecture:

### Domain Layer (`domain/`)
- **Entities**: Core business objects with identity
- **Value Objects**: Immutable objects with no identity
- **Aggregates**: Consistency boundaries for entity clusters
- **Domain Services**: Business logic that doesn't belong to entities
- **Repository Interfaces**: Data access contracts

### Application Layer (`application/`)
- **Use Cases**: Orchestrate domain operations
- **Application Services**: Coordinate multiple use cases
- **DTOs**: Data transfer objects for use case inputs/outputs
- **Mappers**: Convert between domain objects and DTOs

### Infrastructure Layer (`infrastructure/`)
- **Repository Implementations**: Concrete data access using Prisma, Redis, etc.
- **External Services**: HTTP clients, Discord integration
- **Framework Adapters**: Express routes, Discord handlers

## Shared Kernel

The shared kernel contains functionality used across multiple bounded contexts:

### Types (`shared/types/`)
- Common value types (EveId, CharacterId, etc.)
- Shared enums and interfaces
- Result and pagination types

### Utils (`shared/utils/`)
- BigInt transformation utilities
- Common validation functions
- Formatting and conversion helpers

### Interfaces (`shared/interfaces/`)
- Base repository contracts
- Common service interfaces

## Migration Strategy

The DDD structure is being introduced gradually to maintain backward compatibility:

1. **Phase 1** ✅: Create bounded context structure with compatibility layers
2. **Phase 2**: Migrate chart generators to analytics context
3. **Phase 3**: Move Discord handlers to presentation layer
4. **Phase 4**: Migrate remaining services to appropriate contexts
5. **Phase 5**: Clean up legacy structure

## Usage Examples

### Analytics Context - Generate Chart

```typescript
import { Analytics } from '../bounded-contexts';

const config = new Analytics.ChartConfiguration(
  ChartType.KILLS,
  TimePeriod.DAY,
  [BigInt(123456789)],
  startDate,
  endDate
);

const useCase = new Analytics.GenerateChartUseCase(
  killRepo,
  lossRepo,
  cacheRepo,
  renderer
);

const result = await useCase.execute(config);
```

### Legacy Compatibility

```typescript
import { Analytics } from '../bounded-contexts';

const adapter = new Analytics.LegacyChartServiceAdapter(generateChartUseCase);

// Existing code continues to work
const chartData = await adapter.generateKillsChart({
  startDate,
  endDate,
  characterGroups,
  displayType: 'horizontalBar'
});
```

## Benefits

1. **Clear Boundaries**: Each context has well-defined responsibilities
2. **Testability**: Pure domain logic with no external dependencies
3. **Maintainability**: Changes are isolated within context boundaries
4. **Scalability**: Easy to add new features within appropriate contexts
5. **Team Collaboration**: Multiple developers can work on different contexts
6. **Legacy Support**: Gradual migration without breaking existing functionality

## Dependency Rules

1. **Domain** depends on nothing
2. **Application** depends only on domain
3. **Infrastructure** depends on application and domain
4. **Shared Kernel** has no dependencies within the application

## Testing Strategy

Each layer has specific testing approaches:

- **Domain**: Unit tests for entities, value objects, and domain services
- **Application**: Unit tests with mocked repositories for use cases
- **Infrastructure**: Integration tests with real databases/services
- **End-to-End**: Full Discord bot command tests

## Next Steps

1. Complete analytics context implementation
2. Migrate existing chart generators
3. Create presentation layer for Discord commands
4. Implement remaining bounded contexts
5. Gradually remove legacy code