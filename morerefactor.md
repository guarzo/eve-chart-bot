# More Refactoring Tasks

## 1. Consolidate ESI HTTP Clients ✅

- [x] Audit existing ESI clients
- [x] Design unified interface
- [x] Implement combined class
- [x] Switch callers
- [x] Remove old files

## 2. Streamline CLI Commands into Registry ✅

- [x] Introduce CLI entry point
- [x] Convert scripts to subcommands
- [x] Standardize input validation
- [x] Update package.json scripts
- [x] Deprecate old launchers

## 3. Decouple Domain Entities & Prisma Models

- [x] Create centralized mapper
- [x] Create proper domain entities
  - [x] Character
  - [x] CharacterGroup
  - [x] Killmail
- [x] Update repositories to use domain entities
  - [x] CharacterRepository
  - [x] KillRepository
- [x] Create CharacterService
- [x] Update services to use domain entities
  - [x] IngestionService
    - Removed direct Prisma usage
    - Using KillRepository for killmail operations
    - Using CharacterRepository for character operations
    - Using domain entities for data transformation
    - Fixed type issues with null values
  - [x] CharacterSyncService
    - Using CharacterRepository and domain entities
    - Improved error handling and logging
  - [x] KillmailIngestionService
    - Using KillRepository and domain entities
    - Improved error handling and logging
  - [x] MapActivityService
    - Using MapActivityRepository and domain entities
    - Improved error handling and logging
  - [x] ChartService
    - Using CharacterRepository and domain entities
    - Improved error handling and logging
- [ ] Update CLI commands to use domain entities
- [ ] Update Discord commands to use domain entities

## 4. Improve Error Handling

- [x] Create custom error types
- [x] Implement error handling middleware
- [x] Add error logging and monitoring

## 5. RedisQ Consumer Refactor

1. **Consolidate RedisQ Implementation** ✅

   - [x] Audit existing RedisQ consumer code
   - [x] Identify duplicate Redis connections
   - [x] Design unified interface
   - [x] Implement combined class
   - [x] Switch callers
   - [x] Remove old files

2. **Improve Error Handling & Recovery** ✅

   - [x] Add robust error handling for Redis connection issues
   - [x] Implement automatic reconnection logic
   - [x] Add circuit breaker for external API calls
   - [x] Improve logging and monitoring
   - [x] Add health check endpoints

3. **Optimize Performance**

   - [ ] Implement batch processing for killmails
   - [ ] Add rate limiting for ESI calls
   - [ ] Optimize Redis connection pooling
   - [ ] Add caching for frequently accessed data
   - [ ] Implement backpressure handling

4. **Enhance Monitoring & Observability**

   - [x] Add detailed metrics collection
   - [x] Implement structured logging
   - [x] Add performance monitoring
   - [x] Create dashboard for RedisQ status
   - [x] Set up alerts for critical issues

5. **Testing & Reliability**
   - [ ] Add comprehensive unit tests
   - [ ] Implement integration tests
   - [ ] Add chaos testing scenarios
   - [ ] Create load testing suite
   - [ ] Document failure scenarios and recovery procedures

### Implementation Details

1. **Consolidate RedisQ Implementation**

   - Created a new `RedisQService` class that:
     - Manages a single Redis connection
     - Handles killmail ingestion
     - Provides health check methods
     - Implements proper error handling
   - Moved all RedisQ-related code from `redisq-ingest.ts` to the new service
   - Updated all callers to use the new service
   - Removed duplicate Redis connection code

2. **Error Handling & Recovery**

   - Implemented exponential backoff for reconnection attempts
   - Added circuit breaker pattern for external API calls
   - Created custom error types for different failure scenarios
   - Added detailed error logging with context
   - Implemented graceful degradation when services are unavailable

3. **Performance Optimization**

   - Implement batch processing for killmails to reduce database load
   - Add rate limiting for ESI calls to prevent throttling
   - Use connection pooling for Redis to improve resource utilization
   - Implement caching for frequently accessed data
   - Add backpressure handling to prevent memory issues

4. **Monitoring & Observability**

   - Added Prometheus metrics for:
     - RedisQ message processing rate
     - Error rates and types
     - Processing latency
     - Queue depth
   - Implemented structured logging with correlation IDs
   - Created Grafana dashboard for monitoring
   - Set up alerts for critical issues

5. **Testing & Reliability**

   - Add unit tests for all RedisQ functionality
   - Create integration tests with Redis mock
   - Implement chaos testing scenarios
   - Add load testing suite
   - Document failure scenarios and recovery procedures

### Migration Plan

1. **Phase 1: Preparation** ✅

   - Created new `RedisQService` class
   - Added comprehensive test suite
   - Implemented monitoring and logging

2. **Phase 2: Implementation** ✅

   - Migrated existing functionality to new service
   - Added error handling and recovery
   - Implemented performance optimizations

3. **Phase 3: Testing**

   - Run comprehensive test suite
   - Perform load testing
   - Test failure scenarios

4. **Phase 4: Deployment**

   - Deploy to staging environment
   - Monitor performance and errors
   - Gradually roll out to production

5. **Phase 5: Cleanup**
   - Remove old RedisQ implementation
   - Update documentation
   - Archive old code

## 1. Consolidate & Unify the ESI HTTP Clients

1. **Audit existing clients** ✅

   - Compare `infrastructure/http/esi-client.ts` (caching + simple HTTP) with `infrastructure/http/esi.ts` (retry logic).
   - List overlapping methods (e.g. `getCharacter`, `getShip`), their configuration knobs, and test coverage.

2. **Design a single `ESIClient` interface** ✅

   - Define a TypeScript interface in `src/infrastructure/http/ESIClient.ts` that declares all public methods (`fetchCharacter(id)`, `fetchSystems(ids[])`, etc.).
   - Include optional config for retries, backoff, and cache TTL.

3. **Implement a combined concrete class** ✅

   - Create `src/infrastructure/http/UnifiedESIClient.ts` that:
     - Wraps `axios` or your HTTP library
     - Applies retry logic (e.g. with [axios-retry](https://www.npmjs.com/package/axios-retry))
     - Delegates to your `CacheAdapter` for GET requests if enabled
   - Ensure it implements the interface from step 2.

4. **Gradually switch callers** ✅

   - In each service/use-case that used one of the old clients, update imports to point at `UnifiedESIClient`.
   - Run tests to catch behavioral changes.
   - Remove dead code branches (e.g. legacy retry code).

5. **Remove old files & tests** ✅
   - Once everything is migrated, delete `infrastructure/http/esi-client.ts`, `infrastructure/http/esi.ts`, and their test suites.
   - Update your `index.ts` barrel files and DI container (if any).

---

## 2. Streamline CLI Commands into a Registry

1. **Introduce a CLI entrypoint**

   - Create `bot/src/interfaces/cli/registry/index.ts` that uses [commander](https://www.npmjs.com/package/commander) or similar.
   - e.g.
     ```ts
     import { Command } from "commander";
     const cli = new Command();
     // individual commands registered below…
     ```

2. **Convert one‐off scripts to subcommands**

   - For each file in `bot/src/interfaces/cli/character/*.ts`, export a function `register(program: Command)` that wires up its command name, options, and action.
   - In `index.ts`, call `register(cli)` for each.

3. **Standardize input validation & output formatting**

   - Extract common flags/options (e.g. `--verbose`, `--start-date`) into shared helper in `cli/utils.ts`.
   - Ensure all subcommands use the same logging/output conventions.

4. **Update `package.json` scripts**

   - Replace calls to individual CLI scripts with `node dist/cli.js character list` or similar.
   - Document the new command structure in `README.md`.

5. **Deprecate old launchers**
   - Remove top-level executable files once every script has a CLI equivalent.

---

## 3. Decouple Domain Entities & Prisma Models

1. **Centralize model-to-entity mapping**

   - Create `src/infrastructure/mapper/PrismaMapper.ts` with generic helpers:
     ```ts
     export function map<T>(model: any, EntityClass: new (data: any) => T): T {
       return new EntityClass(model);
     }
     ```
   - Or use a library like [class-transformer](https://github.com/typestack/class-transformer).

2. **Refactor repositories**

   - In each repository (`CharacterRepository`, `KillRepository`, etc.), replace manual field‐by‐field mapping with `PrismaMapper.map(model, DomainEntity)`.

3. **Automate middleware mapping**

   - If using Prisma Client, add a [Prisma middleware](https://www.prisma.io/docs/concepts/components/prisma-client/middleware) that runs after each query to convert to plain JS objects, reducing "model vs. raw data" confusion.

4. **Remove leftover mappers/tests**
   - Delete any bespoke `fromModel` methods in domain classes once mapping is centralized.
   - Adjust unit tests to mock domain entities rather than Prisma models directly.

---

## 4. Eliminate Chart Code Duplication

1. **Locate duplicate code**

   - Compare `bot/src/services/charts` and top-level `services/charts`. Note overlaps in config constants and generator logic.

2. **Extract shared modules**

   - Create `src/shared/charts/` for common configs (`EfficiencyChartConfig`, `KillsChartConfig`), interfaces (`ChartData`, `ChartGenerator`), and the `ChartFactory`.

3. **Refactor both consumers**

   - In `bot/` and `services/`, update imports to reference `shared/charts`.
   - Ensure old folders delegate to shared code (or remove them entirely).

4. **Consolidate tests**

   - Move shared chart tests into `shared/charts/__tests__`.
   - Adjust coverage thresholds accordingly.

5. **Finalize cleanup**
   - Delete the now‐empty duplicate directories.
   - Update documentation to point at the single canonical chart implementation.

---
