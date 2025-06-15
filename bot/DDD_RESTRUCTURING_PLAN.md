# Domain-Driven Design (DDD) Restructuring Plan for EVE Online Discord Bot

## 1. Current Problems Violating DDD Principles

### 1.1 Layer Violations
- **Business Logic in Infrastructure**: Chart generation logic is scattered across infrastructure (`lib/`), services, and application layers
- **Domain Logic in Services**: Services like `ChartService.ts` (1492 lines!) contain massive amounts of business logic that should be in domain or application layers
- **Infrastructure Concerns in Domain**: Some domain entities have dependencies on infrastructure components
- **Presentation Logic Mixed with Application**: Discord handlers contain business logic instead of just coordinating

### 1.2 Poor Separation of Concerns
- **Monolithic Services**: `ChartService.ts` handles data fetching, business logic, chart generation, and formatting
- **Duplicate Utilities**: Similar functionality split between `lib/`, `utils/`, and `infrastructure/utils/`
- **Mixed Responsibilities**: Repositories sometimes contain business logic beyond data access
- **Scattered Chart Logic**: Chart generation spread across multiple service implementations without clear boundaries

### 1.3 Dependency Issues
- **Circular Dependencies**: Services depend on repositories which depend on domain entities
- **Infrastructure Leakage**: Domain entities aware of database schema (Prisma types)
- **Tight Coupling**: Discord handlers directly coupled to specific service implementations

## 2. Identified Core Business Domains

### 2.1 Primary Domains
1. **Kill Tracking Domain**
   - Killmails (entity)
   - Kill Facts (value object)
   - Loss Facts (value object)
   - Kill analysis and statistics

2. **Character Management Domain**
   - Characters (entity)
   - Character Groups (entity)
   - Character relationships and hierarchies

3. **Map Activity Domain**
   - Map Activities (entity)
   - Activity tracking and analysis
   - Signature/anomaly management

4. **Analytics & Visualization Domain**
   - Chart generation
   - Data aggregation
   - Performance metrics
   - Efficiency calculations

### 2.2 Supporting Domains
1. **Integration Domain**
   - EVE Online API integration
   - WebSocket data ingestion
   - External service communication

2. **Discord Bot Domain**
   - Command handling
   - User interaction
   - Response formatting

## 3. Proposed DDD Structure

```
/workspace/bot/src/
├── domain/                          # Core business logic - NO external dependencies
│   ├── shared/                      # Shared kernel
│   │   ├── Entity.ts               # Base entity class
│   │   ├── ValueObject.ts          # Base value object class
│   │   ├── DomainEvent.ts          # Base domain event
│   │   └── Result.ts               # Result type for error handling
│   │
│   ├── kill-tracking/              # Kill tracking bounded context
│   │   ├── entities/
│   │   │   └── Killmail.ts
│   │   ├── value-objects/
│   │   │   ├── KillFact.ts
│   │   │   ├── LossFact.ts
│   │   │   ├── ISKValue.ts
│   │   │   └── KillmailId.ts
│   │   ├── aggregates/
│   │   │   └── KillmailAggregate.ts
│   │   ├── repositories/           # Repository interfaces only
│   │   │   └── IKillmailRepository.ts
│   │   ├── services/               # Domain services
│   │   │   └── KillAnalysisService.ts
│   │   └── events/
│   │       ├── KillmailReceivedEvent.ts
│   │       └── KillmailProcessedEvent.ts
│   │
│   ├── character-management/       # Character management bounded context
│   │   ├── entities/
│   │   │   ├── Character.ts
│   │   │   └── CharacterGroup.ts
│   │   ├── value-objects/
│   │   │   ├── CharacterId.ts
│   │   │   └── CharacterName.ts
│   │   ├── aggregates/
│   │   │   └── CharacterGroupAggregate.ts
│   │   ├── repositories/
│   │   │   └── ICharacterRepository.ts
│   │   └── services/
│   │       └── CharacterGroupingService.ts
│   │
│   ├── map-activity/               # Map activity bounded context
│   │   ├── entities/
│   │   │   └── MapActivity.ts
│   │   ├── value-objects/
│   │   │   ├── Signature.ts
│   │   │   └── SystemLocation.ts
│   │   ├── repositories/
│   │   │   └── IMapActivityRepository.ts
│   │   └── services/
│   │       └── ActivityAnalysisService.ts
│   │
│   └── analytics/                  # Analytics bounded context
│       ├── value-objects/
│       │   ├── TimeRange.ts
│       │   ├── ChartConfiguration.ts
│       │   └── AggregatedData.ts
│       ├── services/
│       │   ├── DataAggregationService.ts
│       │   ├── EfficiencyCalculator.ts
│       │   └── TrendAnalyzer.ts
│       └── specifications/
│           ├── KillSpecification.ts
│           └── ActivitySpecification.ts
│
├── application/                    # Application services - orchestration layer
│   ├── shared/
│   │   ├── ICommand.ts
│   │   ├── IQuery.ts
│   │   └── IEventBus.ts
│   │
│   ├── kill-tracking/
│   │   ├── commands/
│   │   │   ├── ProcessKillmailCommand.ts
│   │   │   └── ProcessKillmailHandler.ts
│   │   ├── queries/
│   │   │   ├── GetKillsByCharacterQuery.ts
│   │   │   └── GetKillsByCharacterHandler.ts
│   │   └── services/
│   │       └── KillmailProcessingService.ts
│   │
│   ├── character-management/
│   │   ├── commands/
│   │   │   ├── SyncCharactersCommand.ts
│   │   │   └── CreateCharacterGroupCommand.ts
│   │   └── queries/
│   │       └── GetCharacterGroupsQuery.ts
│   │
│   ├── analytics/
│   │   ├── commands/
│   │   │   └── GenerateChartCommand.ts
│   │   ├── queries/
│   │   │   ├── GetKillsChartDataQuery.ts
│   │   │   ├── GetEfficiencyDataQuery.ts
│   │   │   └── GetActivityHeatmapQuery.ts
│   │   └── services/
│   │       ├── ChartDataPreparationService.ts
│   │       └── ChartGenerationOrchestrator.ts
│   │
│   └── integration/
│       ├── services/
│       │   ├── KillmailIngestionService.ts
│       │   └── MapDataSyncService.ts
│       └── mappers/
│           ├── KillmailMapper.ts
│           └── CharacterMapper.ts
│
├── infrastructure/                 # External dependencies and implementations
│   ├── persistence/
│   │   ├── prisma/
│   │   │   ├── PrismaClient.ts
│   │   │   └── migrations/
│   │   ├── repositories/
│   │   │   ├── PrismaKillmailRepository.ts
│   │   │   ├── PrismaCharacterRepository.ts
│   │   │   └── PrismaMapActivityRepository.ts
│   │   └── mappers/
│   │       ├── KillmailPersistenceMapper.ts
│   │       └── CharacterPersistenceMapper.ts
│   │
│   ├── external-services/
│   │   ├── eve-api/
│   │   │   ├── ESIClient.ts
│   │   │   └── ZkillClient.ts
│   │   ├── websocket/
│   │   │   └── WandererKillsClient.ts
│   │   └── map-api/
│   │       └── MapAPIClient.ts
│   │
│   ├── caching/
│   │   ├── RedisClient.ts
│   │   ├── CacheManager.ts
│   │   └── decorators/
│   │       └── Cacheable.ts
│   │
│   ├── messaging/
│   │   ├── EventBus.ts
│   │   └── CommandBus.ts
│   │
│   ├── monitoring/
│   │   ├── HealthCheckService.ts
│   │   ├── MetricsCollector.ts
│   │   └── TracingService.ts
│   │
│   └── chart-rendering/
│       ├── ChartJSRenderer.ts
│       ├── CanvasManager.ts
│       └── ChartImageGenerator.ts
│
├── presentation/                   # User interface layer
│   ├── discord/
│   │   ├── bot/
│   │   │   ├── DiscordBot.ts
│   │   │   └── CommandRegistry.ts
│   │   ├── commands/
│   │   │   ├── charts/
│   │   │   │   ├── KillsCommand.ts
│   │   │   │   ├── EfficiencyCommand.ts
│   │   │   │   ├── HeatmapCommand.ts
│   │   │   │   └── handlers/
│   │   │   │       └── BaseChartHandler.ts
│   │   │   └── admin/
│   │   │       └── SyncCommand.ts
│   │   ├── interactions/
│   │   │   └── InteractionHandler.ts
│   │   └── formatters/
│   │       ├── ChartEmbedFormatter.ts
│   │       └── ErrorMessageFormatter.ts
│   │
│   ├── api/                       # REST API (if needed)
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── routes/
│   │
│   └── cli/                       # CLI interface
│       ├── commands/
│       └── formatters/
│
├── shared-kernel/                 # Shared utilities and cross-cutting concerns
│   ├── errors/
│   │   ├── DomainError.ts
│   │   ├── ApplicationError.ts
│   │   └── InfrastructureError.ts
│   ├── logging/
│   │   └── Logger.ts
│   ├── validation/
│   │   └── Validator.ts
│   ├── utilities/
│   │   ├── DateUtils.ts
│   │   ├── NumberFormatter.ts
│   │   └── CollectionUtils.ts
│   └── types/
│       └── CommonTypes.ts
│
└── config/                        # Configuration
    ├── Configuration.ts
    ├── DatabaseConfig.ts
    └── DiscordConfig.ts
```

## 4. Migration Strategy

### Phase 1: Foundation (Week 1-2)
1. **Create folder structure** without breaking existing code
2. **Establish shared kernel** with base classes and utilities
3. **Define domain interfaces** for repositories and services
4. **Set up dependency injection** container (e.g., tsyringe)
5. **Create error handling hierarchy**

### Phase 2: Domain Layer (Week 3-4)
1. **Extract domain entities** from existing code
   - Move Character, Killmail, MapActivity to proper domain folders
   - Remove infrastructure dependencies
   - Create value objects for IDs, names, etc.
2. **Define repository interfaces** in domain
3. **Create domain services** for business logic
4. **Implement domain events**

### Phase 3: Infrastructure Layer (Week 5-6)
1. **Implement repository interfaces** with existing Prisma code
2. **Move external service clients** to infrastructure
3. **Create persistence mappers** to convert between domain and database models
4. **Set up event bus** for domain events
5. **Consolidate caching** into infrastructure layer

### Phase 4: Application Layer (Week 7-8)
1. **Create command/query handlers** for each use case
2. **Extract orchestration logic** from existing services
3. **Implement application services** that coordinate domain operations
4. **Create DTOs** for data transfer between layers

### Phase 5: Presentation Layer (Week 9-10)
1. **Refactor Discord commands** to use application layer
2. **Move formatting logic** to presentation layer
3. **Create command handlers** that only handle Discord interaction
4. **Implement proper error handling** and user feedback

### Phase 6: Chart System Refactoring (Week 11-12)
1. **Split ChartService.ts** into:
   - Domain: Chart specifications and calculations
   - Application: Chart data preparation and orchestration
   - Infrastructure: Chart rendering with Chart.js
   - Presentation: Discord embed formatting
2. **Create chart factory pattern** in application layer
3. **Implement chart caching** in infrastructure
4. **Standardize chart configuration**

### Phase 7: Testing and Documentation (Week 13-14)
1. **Write unit tests** for domain layer
2. **Integration tests** for application services
3. **Update documentation** with new architecture
4. **Create developer guide** for new structure

### Phase 8: Cleanup and Optimization (Week 15-16)
1. **Remove old code** gradually
2. **Optimize performance** with proper caching
3. **Implement monitoring** for new architecture
4. **Final testing** and bug fixes

## 5. Implementation Guidelines

### 5.1 Dependency Rules
- **Domain → Nothing** (pure business logic)
- **Application → Domain**
- **Infrastructure → Domain, Application**
- **Presentation → Application, Infrastructure**
- **Never** go in reverse direction

### 5.2 Testing Strategy
- **Domain**: Unit tests with no mocks
- **Application**: Integration tests with mocked infrastructure
- **Infrastructure**: Integration tests with real dependencies
- **Presentation**: E2E tests for user flows

### 5.3 Key Patterns to Implement
- **Repository Pattern**: Already partially in place, needs interface extraction
- **Command/Query Separation (CQRS)**: For clear read/write operations
- **Domain Events**: For decoupling and async operations
- **Dependency Injection**: For proper inversion of control
- **Factory Pattern**: For complex object creation (especially charts)
- **Strategy Pattern**: For different chart types
- **Specification Pattern**: For complex queries

### 5.4 Backward Compatibility
- Keep existing public APIs working during migration
- Use facade pattern to wrap new implementation
- Gradually deprecate old interfaces
- Maintain database schema compatibility

## 6. Benefits of This Structure

1. **Clear Separation of Concerns**: Each layer has a specific responsibility
2. **Testability**: Pure domain logic is easily testable
3. **Maintainability**: Changes are isolated to specific layers
4. **Scalability**: Easy to add new features without affecting existing code
5. **Flexibility**: Can swap infrastructure components without touching business logic
6. **Team Collaboration**: Clear boundaries for different team members
7. **Performance**: Better caching strategies with clear data flow

## 7. Risk Mitigation

1. **Incremental Migration**: Move one bounded context at a time
2. **Feature Flags**: Toggle between old and new implementations
3. **Comprehensive Testing**: Ensure no regression
4. **Monitoring**: Track performance and errors during migration
5. **Rollback Plan**: Keep old code until new is stable
6. **Documentation**: Keep team informed of changes

## 8. Success Metrics

- Reduced coupling (measured by dependency analysis)
- Improved test coverage (target: 80%+ for domain, 60%+ overall)
- Faster feature development (measured by sprint velocity)
- Reduced bug count (tracked in issue tracker)
- Better performance (response time metrics)
- Easier onboarding (developer feedback)

This restructuring will transform the codebase into a maintainable, scalable, and truly domain-driven architecture while preserving all existing functionality.