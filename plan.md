Here’s a step-by-step implementation roadmap to tackle each of the major improvement areas. Feel free to adjust ordering based on your team’s priorities or sprint cadence.

markdown
Copy
Edit

# Detailed Implementation Plan

## 1. Extract a Generic HTTP Client

1. **Create base class**
   - New file: `src/infrastructure/http/HttpClient.ts`
   - Responsibilities:
     - Accepts a URL, headers, params, retry/backoff settings
     - Exposes a method `request<T>(config: RequestConfig): Promise<T>`
2. **Move retry logic**
   - Copy the `retry`/`backoff` loops from both existing ESI and ZKill clients into `HttpClient`
   - Parameterize via `config.maxRetries` and `config.backoffMs`
3. **Subclass for each API**
   - `class EsiClient extends HttpClient { /* inject baseUrl, UA, default headers */ }`
   - `class ZKillClient extends HttpClient { /* same */ }`
4. **Update callers**
   - In services that previously imported low-level fetch code, switch to `new EsiClient().request(...)`
   - Remove duplicated helper functions and imports

---

## 2. Centralize Cache Configuration

1. **Create a config module**
   - New file: `src/config/cache.ts` exporting:
     ```ts
     export const CACHE_PREFIX = process.env.CACHE_PREFIX || "evechart:";
     export const CACHE_TTL = Number(process.env.CACHE_TTL) || 3600;
     ```
2. **Refactor `RedisCache`**
   - Replace hard-coded `"evechart:"` with `CACHE_PREFIX`
   - Replace `3600` with `CACHE_TTL`
3. **Document env vars**
   - Update `.env.example` with `CACHE_PREFIX` and `CACHE_TTL`

---

## 3. Strengthen the Repository Layer

1. **Switch from string names to typed delegates**
   - Update `BaseRepository` constructor to accept `prisma.CharacterDelegate` etc. instead of `modelName: string`
   - Use generics:
     ```ts
     class BaseRepository<T> {
       constructor(private delegate: T) {}
     }
     ```
2. **Invalidate cache on writes**
   - After any `create`/`update`/`delete`, derive affected keys and call `cache.del(key)`
   - Consider a helper `invalidatePattern(prefix: string, pattern: string)` if you use key patterns
3. **Add unit tests**
   - Mock a simple in-memory cache to verify that `.get()`/`.set()`/`.del()` behave as expected

---

## 4. Clean Up Domain Layer

1. **Remove deprecated methods**
   - Delete `Character.setAsMain()` and `setAsAltOf()` entirely
   - Update callers (e.g. group handlers) to use the new workflows
2. **Extract shared validation**
   - New file: `src/domain/validators.ts` with functions like `ensureBigIntString(value: unknown): BigInt`
   - Replace repeated inline checks in constructors with calls to these validators
3. **Add validation tests**
   - For each domain class, verify invalid inputs throw the proper error

---

## 5. Streamline Chart Rendering & Feature Flags

1. **Define a renderer interface**
   - `interface ChartRenderer { renderPNG(data: ChartData): Promise<Buffer> }`
2. **Implement two classes**
   - `RealChartRenderer implements ChartRenderer` (uses Chart.js)
   - `MockChartRenderer implements ChartRenderer` (returns a placeholder)
3. **Wire up via DI or factory**
   - `function getRenderer(mock: boolean): ChartRenderer`
   - Remove all inline `if (featureFlag)` branches
4. **Delete commented code**
   - Grep for `// Chart.js` or feature-flag markers and remove dead blocks

---

## 6. Expand Testing & CI

1. **Unit tests for HTTP client**
   - Mock underlying HTTP lib to throw on first call, succeed on retry
   - Assert `request()` honors `maxRetries` and backoff delays
2. **Integration tests for repository + cache**
   - Spin up a test Redis instance (e.g. via `testcontainers`)
   - Verify reads/writes and invalidation behavior
3. **Add CI job**
   - In your GitHub Actions, add a “cache tests” step to run Redis before test suite
4. **Restore mocks between tests**
   - In your Jest config or each test file, call `jest.resetAllMocks()` in `afterEach`

---

## 7. Reorganize Project Structure

1. **Create top-level folders**  
   src/
   domain/ ← core business logic
   application/ ← orchestration: services, use-cases
   infrastructure/ ← http/, cache/, persistence/
   interfaces/ ← REST controllers, Discord commands, CLI
   shared/ ← config, utils, types

markdown
Copy
Edit 2. **Move files accordingly**

- e.g. `bot/src/infrastructure/http/esi.ts` → `src/infrastructure/http/EsiClient.ts`

3. **Update import paths**

- Grep for old paths and refactor

4. **Verify builds**

- Run `npm run build` and fix any breakages

---

## 8. Adopt Structured Logging & Better Error Handling

1. **Integrate a structured logger**

- Replace string-based logs with `{ event: "...", metadata }` using Pino or Bunyan

2. **Audit catch blocks**

- For critical flows (e.g. ingestion), remove swallow-and-null patterns
- Instead:
  ```ts
  try {
    …
  } catch (err) {
    logger.error({ event: "ingest_fail", err });
    throw err;
  }
  ```

3. **Add log-level config**

- Expose `LOG_LEVEL` via env
- Default to `info` in prod, `debug` in dev

---

> **Estimate**: 3–4 weeks of combined effort, depending on team size.  
> **Milestones**:
>
> 1. Generic HTTP client & cache config (Week 1)
> 2. Repository refactor & domain cleanup (Week 2)
> 3. Chart renderer cleanup & CI tests (Week 3)
> 4. Project reorg & structured logging (Week 4)
>    Let me know if you’d like to adjust priorities or split any of these into separate epics!
