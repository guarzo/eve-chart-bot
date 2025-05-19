## 1. Consolidate & Unify the ESI HTTP Clients

1. **Audit existing clients**

   - Compare `infrastructure/http/esi-client.ts` (caching + simple HTTP) with `infrastructure/http/esi.ts` (retry logic).
   - List overlapping methods (e.g. `getCharacter`, `getShip`), their configuration knobs, and test coverage.

2. **Design a single `ESIClient` interface**

   - Define a TypeScript interface in `src/infrastructure/http/ESIClient.ts` that declares all public methods (`fetchCharacter(id)`, `fetchSystems(ids[])`, etc.).
   - Include optional config for retries, backoff, and cache TTL.

3. **Implement a combined concrete class**

   - Create `src/infrastructure/http/UnifiedESIClient.ts` that:
     - Wraps `axios` or your HTTP library
     - Applies retry logic (e.g. with [axios-retry](https://www.npmjs.com/package/axios-retry))
     - Delegates to your `CacheAdapter` for GET requests if enabled
   - Ensure it implements the interface from step 2.

4. **Gradually switch callers**

   - In each service/use-case that used one of the old clients, update imports to point at `UnifiedESIClient`.
   - Run tests to catch behavioral changes.
   - Remove dead code branches (e.g. legacy retry code).

5. **Remove old files & tests**
   - Once everything is migrated, delete `infrastructure/http/esi-client.ts`, `infrastructure/http/esi.ts`, and their test suites.
   - Update your `index.ts` barrel files and DI container (if any).

---

## 2. Streamline CLI Commands into a Registry

1. **Introduce a CLI entrypoint**

   - Create `bot/src/interfaces/cli/index.ts` that uses [commander](https://www.npmjs.com/package/commander) or similar.
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

   - If using Prisma Client, add a [Prisma middleware](https://www.prisma.io/docs/concepts/components/prisma-client/middleware) that runs after each query to convert to plain JS objects, reducing “model vs. raw data” confusion.

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
