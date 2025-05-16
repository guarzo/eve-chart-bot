# Chart Reference

This technical reference document describes the data models and chart types used in our Discord bot. For user-facing documentation, see [chart-commands.md](../api/chart-commands.md).

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

### LossFact

```prisma
model LossFact {
  killmailId    BigInt   @id
  characterId   BigInt
  lossTime      DateTime
  shipTypeId    Int
  systemId      Int
  totalValue    BigInt
  attackerCount Int
  attackers     Json     // Detailed attacker info

  @@index([characterId, lossTime])
  @@map("losses_fact")
}
```

---

## Chart Types

### Current Implementation

1. **Kills Chart**

   - **Command:** `/charts kills [time]`
   - **Data:** Aggregates **KillFact** by character group
   - **Display:** Stacked horizontal bar chart showing _total kills_ and _solo kills_

2. **Map Activity Chart**

   - **Command:** `/charts map [time]`
   - **Data:** Aggregates **MapActivity** by character group
   - **Display:** Stacked horizontal bar chart showing _signatures_, _connections_, and _passages_

3. **Losses Chart**

   - **Command:** `/charts losses [time]`
   - **Data:** Aggregates **LossFact** by character group
   - **Display:** Dual-axis chart with total losses (bars) and ISK lost (line)

4. **Kill-Death Ratio Chart**

   - **Command:** `/charts ratio [time]`
   - **Data:** Ratio of kills to deaths per character group
   - **Display:** Gauge chart for K/D ratio and bullet chart for efficiency

5. **Ship Types Chart**

   - **Command:** `/charts shiptypes [time]`
   - **Data:** Aggregates **KillFact.shipTypeId**
   - **Display:** Horizontal bar of top ship types destroyed

6. **Distribution Chart**

   - **Command:** `/charts distribution [time]`
   - **Data:** Analyzes **KillFact.attackerCount** distribution
   - **Display:** Box plot and violin chart showing group size distribution

7. **Heatmap Chart**

   - **Command:** `/charts heatmap [time]`
   - **Data:** Aggregates **KillFact** by hour and day of week
   - **Display:** 7×24 heatmap showing activity patterns

8. **Trend Chart**

   - **Command:** `/charts trend [time]`
   - **Data:** Daily aggregates of **KillFact**
   - **Display:** Time-series line chart showing activity over time

9. **Corporation Kills Chart**
   - **Command:** `/charts corps [time]`
   - **Data:** Aggregates **KillFact** by victim corporation
   - **Display:** Horizontal bar chart of top corporations

---

## Chart Implementation

We use Chart.js with the following plugins:

- chartjs-chart-matrix (for heatmaps)
- chartjs-chart-boxplot (for box plots and violin charts)
- chartjs-plugin-datalabels (for value labels)

Example configuration:

```typescript
const chartConfig = {
  type: "bar" | "line" | "boxplot" | "violin" | "matrix",
  data: {
    labels: [...],
    datasets: [
      {
        label: "Primary Metric",
        data: [...],
        backgroundColor: getThemeColors()[0],
        borderColor: getThemeColors()[0],
        borderWidth: 1,
        yAxisID: "y1",     // for dual-axis charts
      },
      {
        label: "Secondary Metric",
        data: [...],
        type: "line",
        yAxisID: "y2",
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        title: { display: true, text: "X Axis" }
      },
      y: {
        stacked: true,
        title: { display: true, text: "Y Axis" }
      },
      y2: {
        position: "right",
        grid: { drawOnChartArea: false }
      }
    },
    plugins: {
      legend: {
        position: "top",
        labels: { usePointStyle: true }
      },
      tooltip: {
        mode: "index",
        intersect: false
      }
    }
  }
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

### Loss Aggregation Query

```typescript
// For losses chart
SELECT
  c.characterGroupId,
  COUNT(l.killmailId) AS totalLosses,
  SUM(l.totalValue) AS totalValue
FROM losses_fact l
JOIN characters c ON l.characterId = c.eveId
WHERE l.lossTime BETWEEN ${start} AND ${end}
GROUP BY c.characterGroupId
ORDER BY totalLosses DESC;
```

### Distribution Query

```typescript
// For distribution chart
SELECT
  c.characterGroupId,
  k.attackerCount,
  COUNT(*) as count
FROM kills_fact k
JOIN characters c ON k.characterId = c.eveId
WHERE k.killTime BETWEEN ${start} AND ${end}
GROUP BY c.characterGroupId, k.attackerCount
ORDER BY c.characterGroupId, k.attackerCount;
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
