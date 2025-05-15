# EVE Chart Bot Architecture

## Overview

EVE Chart Bot is structured using a layered architecture that separates concerns and promotes maintainability. The application is divided into the following layers:

1. **Domain Layer** - Core business logic and entities
2. **Application Layer** - Services and use cases
3. **Infrastructure Layer** - External dependencies and technical concerns
4. **Interfaces Layer** - User interfaces (CLI, REST API, Discord)

## Layer Responsibilities

### Domain Layer (`src/domain/`)

The domain layer contains the core business logic of the application, independent of any external concerns. This includes:

- Business entities and value objects
- Business rules and validation
- Domain services and pure functions

Key components:

- `character/grouping.ts` - Character grouping logic

### Application Layer (`src/application/`)

The application layer orchestrates and coordinates between the domain layer and the infrastructure. It contains:

- Use cases that implement application-specific business rules
- Services that orchestrate domain objects
- Application state management

Key components:

- `chart/ChartService.ts` - Chart generation service
- `chart/ChartRenderer.ts` - Chart rendering service
- `ingestion/IngestionService.ts` - Killmail ingestion service

### Infrastructure Layer (`src/infrastructure/`)

The infrastructure layer handles interactions with external systems, libraries, and frameworks:

- Database access (Prisma)
- External APIs (ESI, ZKillboard)
- Caching mechanisms
- File system access
- Message queues

Key components:

- `persistence/client.ts` - Centralized Prisma client
- `http/esi.ts` - EVE ESI API client
- `http/zkill.ts` - ZKillboard API client
- `cache/RedisCache.ts` - Redis cache implementation
- `utils/retry.ts` - Retry utilities for external calls

### Interfaces Layer (`src/interfaces/`)

The interfaces layer provides different ways for users to interact with the application:

- CLI commands
- REST API endpoints
- Discord bot commands
- GraphQL resolvers

Key components:

- `cli/index.ts` - CLI command framework
- `cli/commands/` - Individual CLI commands
- `rest/index.ts` - REST API server
- `rest/routes/` - API route handlers

## Data Flow

1. User input is received through one of the interface layers
2. The interface layer calls appropriate application services
3. Application services coordinate domain objects and infrastructure services
4. Domain logic is executed
5. Results flow back up through the layers to the user

## Key Patterns

- **Dependency Injection** - Services are designed to receive their dependencies
- **Repository Pattern** - Data access is abstracted through repositories
- **Adapter Pattern** - External services are abstracted through adapters
- **Command Pattern** - CLI commands follow the command pattern

## Dependencies

- Prisma - Database ORM
- Redis - Caching
- Express - REST API server
- Yargs - CLI framework
- Axios - HTTP client
- Jest - Testing framework
