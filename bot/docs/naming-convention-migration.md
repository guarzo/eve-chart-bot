# Naming Convention Migration Guide

This guide documents the naming convention improvements made to the EVE Online Discord Bot codebase.

## Overview of Changes

1. **Prisma Schema**: All models now use camelCase properties with `@map` annotations for database compatibility
2. **MapClient Renamed**: `MapClient` renamed to `WandererMapClient` to avoid confusion with JavaScript's `Map`
3. **DTOs Created**: Proper separation between external API DTOs (snake_case) and internal domain DTOs (camelCase)
4. **Mapping Utilities**: Centralized mappers for converting between formats

## 1. Prisma Schema Changes

### Before
```prisma
model KillFact {
  killmail_id      BigInt         @id
  kill_time        DateTime
  ship_type_id     Int
  // ... snake_case fields
}
```

### After
```prisma
model KillFact {
  killmailId      BigInt         @id @map("killmail_id")
  killTime        DateTime       @map("kill_time")
  shipTypeId      Int            @map("ship_type_id")
  // ... camelCase fields with @map
}
```

### All Updated Models
- `Character` - Already had proper mapping
- `CharacterGroup` - Fixed `map_name` → `mapName`
- `MapActivity` - Already had proper mapping
- `KillFact` - All fields now camelCase
- `LossFact` - All fields now camelCase
- `KillAttacker` - All fields now camelCase
- `KillVictim` - All fields now camelCase
- `KillCharacter` - All fields now camelCase

## 2. MapClient → WandererMapClient

### Import Changes
```typescript
// Before
import { MapClient } from '../../infrastructure/http/MapClient';

// After (both work during migration)
import { WandererMapClient } from '../../infrastructure/http/WandererMapClient';
// OR
import { MapClient } from '../../infrastructure/http'; // Backward compatible alias
```

### Usage Changes
```typescript
// Before (confusing with Map<K,V>)
private readonly map: MapClient;

// After (clear it's the Wanderer Map API client)
private readonly map: WandererMapClient;
```

## 3. DTO Structure

### External API DTOs (snake_case)
Located in `src/shared/dto/external-api.dto.ts`:
- `KillmailApiDto` - ESI killmail format
- `VictimApiDto` - ESI victim format
- `AttackerApiDto` - ESI attacker format
- `MapActivityApiDto` - Wanderer Map activity format
- `WebSocketKillmailDto` - WebSocket killmail format

### Domain DTOs (camelCase)
Located in `src/shared/dto/domain.dto.ts`:
- `KillmailDto` - Internal killmail format
- `VictimDto` - Internal victim format
- `AttackerDto` - Internal attacker format
- `CharacterDto` - Internal character format
- `MapActivityDto` - Internal activity format

## 4. Mapping Utilities

### Usage Examples

```typescript
import { 
  mapKillmailApiToDomain,
  mapWebSocketKillmailToDomain,
  mapMapActivityApiToDomain 
} from '../shared/mappers/dto.mapper';

// Convert ESI killmail to domain format
const domainKillmail = mapKillmailApiToDomain(esiKillmail);

// Convert WebSocket killmail to domain format
const domainKillmail = mapWebSocketKillmailToDomain(wsKillmail);

// Convert Wanderer Map activity to domain format
const domainActivity = mapMapActivityApiToDomain(mapActivity);
```

## 5. Repository Updates

### Before
```typescript
const killFacts = await this.prisma.killFact.findMany({
  where: {
    kill_time: { gte: startDate },
    character_id: { in: characterIds }
  }
});
```

### After
```typescript
const killFacts = await this.prisma.killFact.findMany({
  where: {
    killTime: { gte: startDate },
    characterId: { in: characterIds }
  }
});
```

## 6. Benefits

1. **Consistency**: All TypeScript code uses camelCase
2. **Type Safety**: Clear separation between external and internal types
3. **Clarity**: `WandererMapClient` clearly indicates its purpose
4. **Maintainability**: Centralized mapping logic
5. **Database Compatibility**: `@map` annotations preserve existing database schema

## 7. Migration Checklist

- [x] Update Prisma schema with camelCase and @map annotations
- [x] Rename MapClient to WandererMapClient
- [x] Create external API DTOs (snake_case)
- [x] Create domain DTOs (camelCase)
- [x] Create mapping utilities
- [x] Update repository implementations
- [x] Add backward compatibility exports
- [ ] Run `npx prisma generate` to update Prisma client
- [ ] Update remaining service implementations
- [ ] Remove deprecated imports

## 8. No Database Migration Required

Since we're using `@map` annotations, the database schema remains unchanged. Only the TypeScript interface changes, making this a zero-downtime update.