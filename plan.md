### Implementation Plan for Codebase Refactoring

**Goal:** Improve database client handling, enforce Clean Architecture, DRY up query logic, standardize caching on Redis, audit all `TODO` comments, and refactor chart generation flow based on review. Each step is detailed for a junior developer.

---

#### 1. Create a Single `PrismaClient` Instance
2. **File:** `infrastructure/persistence/client.ts`  
   ```ts
   import { PrismaClient } from '@prisma/client';

   const prisma = new PrismaClient();
   export default prisma;
   ```  
3. **Update Repositories** (`infrastructure/repositories/*`):  
   - Remove `new PrismaClient()` from constructors.  
   - At top of each file:
     ```ts
     import prisma from '../persistence/client';
     ```  
   - Replace local client usage with `prisma`.  
4. **Verify & Test:**  
   - Run `npm run build`.  
   - Add or update a basic query test to confirm functionality.

---

#### 2. Refactor Folder Structure for Clean Architecture
2. **Rename Folders:**  
   - `src/data/repositories` → `src/infrastructure/repositories`  
   - `src/data/models` → `src/domain/models`  
   - `src/application` → `src/usecases`  
3. **Update Imports:**  
   ```diff
   - import { UserRepo } from '../data/repositories'
   + import { UserRepo } from '../infrastructure/repositories'
   ```  
4. **Verify:**  
   - Run `npm run build`.  
   - Execute full test suite.

---

#### 3. Extract Shared Query Logic
2. **Helper File:** `src/utils/query-helper.ts`  
   ```ts
   export function buildWhereFilter(filters: Record<string, any>) {
     return Object.entries(filters).reduce((acc, [key, value]) => {
       if (key.toLowerCase().includes('date')) {
         acc[key] = { gte: new Date(value) };
       } else {
         acc[key] = value;
       }
       return acc;
     }, {} as any);
   }
   ```  
3. **Refactor Repositories:**  
   ```ts
   import { buildWhereFilter } from '../../utils/query-helper';

   const where = buildWhereFilter({ createdAt: startDate });
   const users = await prisma.user.findMany({ where });
   ```  
4. **Test:**  
   - Write unit tests for `buildWhereFilter`.

---

#### 4. Standardize Caching on Redis
2. **Install Redis Client:**  
   ```bash
   npm install ioredis
   ```  
3. **Redis Client File:** `src/infrastructure/cache/redis-client.ts`  
   ```ts
   import Redis from 'ioredis';
   const redis = new Redis(process.env.REDIS_URL);
   export default redis;
   ```  
4. **Replace In-Memory Cache:**  
   - Remove `BaseRepository.cache`.  
   - Import and use:
     ```ts
     import redis from '../cache/redis-client';

     await redis.set(cacheKey, JSON.stringify(data), 'EX', 3600);
     const raw = await redis.get(cacheKey);
     const data = raw ? JSON.parse(raw) : null;
     ```  
5. **Env Setup:**  
   - Add `REDIS_URL` to `.env.example`.  
6. **Test:**  
   - Integration test: set and get via Redis.

---

#### 5. Audit and Handle `TODO` Comments
2. **Find TODOs:**  
   ```bash
   grep -R "TODO" -n src/
   ```  
3. **Categorize:**  
   - Implement core ones now.  
   - Wrap incomplete features behind flags.  
   - Remove obsolete comments.  
4. **Feature Flags Utility:** `src/utils/feature-flags.ts`  
   ```ts
   export const flags = {
     newChartFeature: process.env.NEW_CHART_FEATURE === 'true',
   };
   ```  
   - Guard code:
     ```ts
     import { flags } from '../../utils/feature-flags';
     if (flags.newChartFeature) {
       // new implementation
     }
     ```  
5. **Cleanup:**  
   - Remove handled `TODO`s.  
   - Verify no lingering stubs.

---

#### 6. Refactor Chart Generation Flow :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
2. **Audit Suggestions:** Review `chart-generation-review.md` for duplication and DI improvements.  
3. **Create Formatting Utility:**  
   - **File:** `bot/src/services/charts/utils/FormatUtils.ts`  
   ```ts
   export class FormatUtils {
     static formatValue(value: number): string {
       if (value >= 1_000_000_000) { return `${(value/1_000_000_000).toFixed(1)}B`; }
       else if (value >= 1_000_000) { return `${(value/1_000_000).toFixed(1)}M`; }
       else if (value >= 1_000) { return `${(value/1_000).toFixed(1)}K`; }
       else { return value.toString(); }
     }

     static formatBigIntValue(value: bigint): string {
       return this.formatValue(Number(value.toString()));
     }

     static formatIsk(value: bigint): string {
       const n = Number(value);
       if (n >= 1_000_000_000_000) { return `${(n/1_000_000_000_000).toFixed(2)}T`; }
       else if (n >= 1_000_000_000) { return `${(n/1_000_000_000).toFixed(2)}B`; }
       else if (n >= 1_000_000) { return `${(n/1_000_000).toFixed(2)}M`; }
       else if (n >= 1_000) { return `${(n/1_000).toFixed(2)}K`; }
       else { return n.toString(); }
     }
   }
   ```  
4. **Create Layout Utility:**  
   - **File:** `bot/src/services/charts/utils/ChartLayoutUtils.ts`  
   ```ts
   import { ChartData, ChartDisplayType } from "../../../types/chart";

   export class ChartLayoutUtils {
     static createHorizontalBarLayout(
       labels: string[],
       datasets: { label: string; data: number[]; backgroundColor: string; }[],
       title: string
     ): ChartData {
       return {
         labels,
         datasets,
         displayType: "horizontalBar" as ChartDisplayType,
         options: {
           indexAxis: "y",
           scales: { x: { beginAtZero: true }, y: { stacked: true } },
           plugins: {
             title: { display: true, text: title },
             legend: { position: "top" },
           },
         },
       };
     }
   }
   ```  
5. **Create Time Utility:**  
   - **File:** `bot/src/services/charts/utils/TimeUtils.ts`  
   ```ts
   import { format } from "date-fns";

   export class TimeUtils {
     static getGroupByFormat(groupBy: "hour"|"day"|"week"): string {
       switch(groupBy) {
         case "hour": return "HH:mm";
         case "week": return "MMM dd";
         default: return "MMM dd";
       }
     }
     static formatTimeRange(start: Date, end: Date): string {
       return `${format(start,"yyyy-MM-dd")} to ${format(end,"yyyy-MM-dd")}`;
     }
   }
   ```  
6. **Enable Dependency Injection:**  
   - **Update** `BaseChartGenerator` constructor:
     ```ts
     import { RepositoryManager } from "../../../infrastructure/repositories/RepositoryManager";

     export abstract class BaseChartGenerator {
       constructor(protected repoMgr: RepositoryManager) {}
       // remove direct new Repo() calls
     }
     ```  
7. **Update ChartFactory:**  
   - Instantiate a single `RepositoryManager` and pass into each generator.  
8. **Refactor Generators:**  
   - **Remove** duplicate `formatValue`/`formatIsk`.  
   - **Import** and use `FormatUtils`, `ChartLayoutUtils`, `TimeUtils`.  
   - **Ensure** configuration is accessed via a consistent config module.  
9. **Verify & Test:**  
   - Unit tests for each new util.  
   - Integration tests for chart generation end-to-end.

---

### Final Steps
- Request reviews, address feedback.  
- Merge to staging, run smoke tests.  
- Monitor logs & metrics for any regressions.  

