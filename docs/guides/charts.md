# Chart Reference

This technical reference document describes the data models and chart types used in our Discord bot. For user-facing documentation, see [chart-commands.md](chart-commands.md). :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}

## Data Models

### KillFact

```prisma
model KillFact {
  killmailId    BigInt   @id
  characterId   BigInt
  killTime      DateTime
  npc           Boolean
  solo          Boolean
  awox          Boolean
  shipTypeId    Int
  systemId      Int
  labels        String[]
  totalValue    BigInt
  points        Int
  attackerCount Int      // Number of attackers
  attackers     Json     // Detailed attacker info (damage, finalBlow flag, etc.)

  @@index([characterId, killTime])
  @@map("kills_fact")
}
```

### Character

```prisma
model Character {
  eveId              String
  name               String
  allianceId         Int?
  allianceTicker     String?
  corporationId      Int
  corporationTicker  String
  isMain             Boolean
  characterGroupId   String?
  mainCharacterId    String?
}
```

### MapActivity

```prisma
model MapActivity {
  characterId   BigInt
  timestamp     DateTime
  signatures    Int
  connections   Int
  passages      Int
  allianceId    Int?
  corporationId Int
}
```

---

## Simplified Chart Types

### Current Implementation

1. **Kills Chart**  
   - **Command:** `/charts kills [time]`  
   - **Data:** Aggregates **KillFact** by character group  
   - **Display:** Stacked horizontal bar chart showing _total kills_ and _solo kills_  

2. **Map Activity Chart**  
   - **Command:** `/charts map [time]`  
   - **Data:** Aggregates **MapActivity** by character group  
   - **Display:** Stacked horizontal bar chart showing _signatures_, _connections_, and _passages_  

### Planned & New Future Chart Types

1. **Deaths Chart**  
   - **Command:** `/charts deaths [time]`  
   - **Data:** _KillFact_ where our characters are _victims_ (requires a **LossFact** or inverse query)  
   - **Display:** Stacked horizontal bar showing _total deaths_ and _solo deaths_  

2. **Kill-Death Ratio Chart**  
   - **Command:** `/charts ratio [time]`  
   - **Data:** Ratio of kills to deaths per character group (and optional ISK efficiency)  
   - **Display:** Horizontal bar (K/D) + line (ISK efficiency %) on dual axes  

3. **Ship Types Chart**  
   - **Command:** `/charts shiptypes [time]`  
   - **Data:** Aggregates **KillFact.shipTypeId**  
   - **Display:** Horizontal bar of top ship types destroyed  

4. **Kill Distribution Chart**  
   - **Command:** `/charts distribution [time]`  
   - **Data:** Categorizes kills as _solo_, _small-group (2–5)_, or _large-group (6+)_  
   - **Display:** Pie chart (or 3-bar horizontal)  

5. **Hourly Activity Chart**  
   - **Command:** `/charts hourly [time]`  
   - **Data:** Aggregates **KillFact** by _hour of day_  
   - **Display:** Vertical bar  

6. **Corporation Kills Chart**  
   - **Command:** `/charts corps [time]`  
   - **Data:** Aggregates **KillFact** by _victim corporation_  
   - **Display:** Horizontal bar  

---

#### **New Additions from Your Examples**

7. **Damage vs Final Blows Chart**  
   - **Command:** `/charts damage [time]`  
   - **Data:**  
     - **Damage Done** = sum(attacker.damage) from **KillFact.attackers** JSON  
     - **Final Blows** = count(attacker.finalBlow = true)  
   - **Display:** Mixed: bar (damage) + line (final‐blow count) with dual axes  

8. **Character Performance Chart**  
   - **Command:** `/charts performance [time]`  
   - **Data:**  
     - _Total kills_ and _solo kills_ (from **KillFact**)  
     - _Points_ (from **KillFact.points**)  
   - **Display:** Stacked bar (kills + solo) + line (points) on dual axes  

9. **Ship Usage Chart**  
   - **Command:** `/charts shipusage [time]`  
   - **Data:** Distribution of kills by **shipTypeId** per character group  
   - **Display:** Stacked horizontal bar (each segment = one ship type)  

10. **Trend (Time-Series) Chart**  
    - **Command:** `/charts trend [time]`  
    - **Data:** Daily aggregates of kills (or value) from **KillFact**  
    - **Display:** Area or line chart over time  

11. **Kills Heatmap**  
    - **Command:** `/charts heatmap [time]`  
    - **Data:** Counts of kills binned by _weekday_ & _hour_ (from **killTime**)  
    - **Display:** Calendar-style heatmap  

12. **Ships Word Cloud**  
    - **Command:** `/charts wordcloud [time]`  
    - **Data:** Top ship types (\`shipTypeId\`) frequency  
    - **Display:** Word cloud (size ∝ kill count)  

13. **Fleet Activity Chart**  
    - **Command:** `/charts fleet [time]`  
    - **Data:**  
      - _Total value_ killed (sum **totalValue**)  
      - _Average fleet size_ (avg **attackerCount**)  
    - **Display:** Dual‐axis line chart over time  

14. **Combined Losses Chart** _(optional)_  
    - **Command:** `/charts losses [time]`  
    - **Data:** Requires tracking losses (victim side)  
    - **Display:** Bar (loss value) + line (loss count)  

---

## Chart Implementation

We use Chart.js (plus plugins where needed) with:

```javascript
const chartConfig = {
  type: "bar" | "horizontalBar" | "pie" | "line" | "mixed",   // etc.
  data: {
    labels: [...],
    datasets: [
      {
        label: "Primary Metric",
        data: [...],
        backgroundColor: "#36a2eb",
        type: "bar",       // for mixed charts
        yAxisID: "y1",     // when dual axes
      },
      {
        label: "Secondary Metric",
        data: [...],
        type: "line",
        yAxisID: "y2",
      },
      // ...
    ],
  },
  options: {
    indexAxis: "y",      // for horizontalBar
    scales: {
      x: { stacked: true },
      y: { stacked: false, position: "left", id: "y1" },
      y2: { position: "right", grid: { drawOnChartArea: false } },
    },
    plugins: {
      legend: { display: true },
      title: { display: true, text: "Chart Title" },
    },
  },
};
```

---

## Query Patterns

### Group Aggregation Query

```typescript
// By character group (e.g. for /charts kills or performance)
SELECT
  c.characterGroupId,
  COUNT(k.killmailId) AS totalKills,
  SUM(CASE WHEN k.solo THEN 1 ELSE 0 END) AS soloKills,
  SUM(k.points) AS totalPoints
FROM kills_fact k
JOIN characters c ON k.characterId = c.eveId
WHERE k.killTime BETWEEN ${start} AND ${end}
GROUP BY c.characterGroupId
ORDER BY totalKills DESC;
```

### Damage vs Final Blows Query

```typescript
// Assumes attackers JSON array with {damage, finalBlow} per entry
SELECT
  c.characterGroupId,
  SUM((attacker->>'damage')::int) AS totalDamage,
  SUM(CASE WHEN (attacker->>'finalBlow') = 'true' THEN 1 ELSE 0 END) AS finalBlows
FROM kills_fact k
JOIN characters c ON k.characterId = c.eveId
CROSS JOIN LATERAL json_array_elements(k.attackers) AS attacker
WHERE k.killTime BETWEEN ${start} AND ${end}
GROUP BY c.characterGroupId
ORDER BY totalDamage DESC;
```

### Heatmap Query

```typescript
SELECT
  EXTRACT(DOW FROM k.killTime) AS weekday,
  EXTRACT(HOUR FROM k.killTime) AS hour,
  COUNT(*) AS kills
FROM kills_fact k
WHERE k.killTime BETWEEN ${start} AND ${end}
GROUP BY weekday, hour;
```
