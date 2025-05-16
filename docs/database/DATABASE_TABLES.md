# Database Schema and ESI Integration

This document describes the database schema, table relationships, and ESI integration for the EVE Chart Bot.

## Database Schema Overview

The application uses the following tables:

1. `map_activities` - Tracks character map activity
2. `kill_facts` - Stores killmail data
3. `kill_victims` - Stores victim information for killmails
4. `kill_attackers` - Stores attacker information for killmails
5. `kill_characters` - Junction table for killmail-character relationships
6. `losses_fact` - Stores loss data
7. `characters` - Character information
8. `corporations` - Corporation information
9. `alliances` - Alliance information

## Table Definitions

### Map Activity

```prisma
model MapActivity {
  characterId   BigInt   @map("character_id")
  timestamp     DateTime
  signatures    Int      // Number of signatures scanned
  connections   Int      // Number of wormhole connections
  passages      Int      // Number of system passages
  allianceId    Int?     @map("alliance_id")
  corporationId Int      @map("corporation_id")

  @@id([characterId, timestamp])
  @@index([characterId, timestamp])
  @@index([corporationId, timestamp])
  @@map("map_activities")
}
```

### Kill Facts

```prisma
model KillFact {
  killmailId    BigInt   @id
  killTime      DateTime
  systemId      Int
  totalValue    BigInt
  points        Int
  position      Json     // {x, y, z} coordinates
  items         Json     // Array of dropped/destroyed items

  // Relationships
  victim        KillVictim?
  attackers     KillAttacker[]
  characters    KillCharacter[]  // Many-to-many with characters

  @@index([killTime])
  @@index([systemId])
  @@map("kill_facts")
}

model KillVictim {
  id            Int      @id @default(autoincrement())
  killmailId    BigInt   @unique
  characterId   BigInt?
  corporationId Int?
  allianceId    Int?
  shipTypeId    Int
  damageTaken   Int

  // Relationships
  kill          KillFact @relation(fields: [killmailId], references: [killmailId])
  character     Character? @relation(fields: [characterId], references: [eveId])

  @@index([characterId])
  @@index([corporationId])
  @@index([allianceId])
  @@map("kill_victims")
}

model KillAttacker {
  id            Int      @id @default(autoincrement())
  killmailId    BigInt
  characterId   BigInt?
  corporationId Int?
  allianceId    Int?
  damageDone    Int
  finalBlow     Boolean
  securityStatus Float
  shipTypeId    Int
  weaponTypeId  Int

  // Relationships
  kill          KillFact @relation(fields: [killmailId], references: [killmailId])
  character     Character? @relation(fields: [characterId], references: [eveId])

  @@index([killmailId])
  @@index([characterId])
  @@index([corporationId])
  @@index([allianceId])
  @@map("kill_attackers")
}

model KillCharacter {
  killmailId    BigInt
  characterId   BigInt
  role          String   // "attacker" or "victim"

  // Relationships
  kill          KillFact @relation(fields: [killmailId], references: [killmailId])
  character     Character @relation(fields: [characterId], references: [eveId])

  @@id([killmailId, characterId])
  @@index([characterId])
  @@map("kill_characters")
}
```

### Loss Facts

```prisma
model LossFact {
  killmailId    BigInt   @id
  characterId   BigInt
  killTime      DateTime
  shipTypeId    Int
  systemId      Int
  totalValue    BigInt
  attackerCount Int
  attackers     Json     // Detailed attacker info

  character     Character @relation(fields: [characterId], references: [eveId])

  @@index([characterId, killTime])
  @@map("losses_fact")
}
```

### Character Information

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

  // Relationships
  kills             KillCharacter[]
  losses            LossFact[]
  mapActivity       MapActivity[]

  @@id([eveId])
  @@index([corporationId])
  @@index([allianceId])
  @@index([characterGroupId])
  @@map("characters")
}
```

## ESI Integration

### Data Sources

1. **Killmail Data**

   - Source: `https://esi.evetech.net/latest/killmails/{killmail_id}/{hash}/`
   - Used for: Attacker details, victim details, item drops, position data
   - Rate Limits: 100 requests per second

2. **Character Data**

   - Source: `https://esi.evetech.net/latest/characters/{character_id}/`
   - Used for: Character details, corporation/alliance info
   - Rate Limits: 100 requests per second

3. **Map Data**
   - Source: `https://api.eve-map.net/`
   - Used for: Map activity tracking
   - Rate Limits: 100 requests per minute

### Data Processing

1. **Killmail Processing**

   ```typescript
   async function processKillmail(killmail: RedisQKillmail) {
     // 1. Get ESI data
     const esiData = await fetchESIKillmail(killmail.killID, killmail.hash);

     // 2. Process victim
     const victim = {
       characterId: esiData.victim.character_id,
       corporationId: esiData.victim.corporation_id,
       allianceId: esiData.victim.alliance_id,
       shipTypeId: esiData.victim.ship_type_id,
       damageTaken: esiData.victim.damage_taken,
     };

     // 3. Process attackers
     const attackers = esiData.attackers.map((attacker) => ({
       characterId: attacker.character_id,
       corporationId: attacker.corporation_id,
       allianceId: attacker.alliance_id,
       damageDone: attacker.damage_done,
       finalBlow: attacker.final_blow,
       securityStatus: attacker.security_status,
       shipTypeId: attacker.ship_type_id,
       weaponTypeId: attacker.weapon_type_id,
     }));

     // 4. Create character relationships
     const characterRelations = [
       ...(victim.characterId
         ? [{ characterId: victim.characterId, role: "victim" }]
         : []),
       ...attackers
         .filter((a) => a.characterId)
         .map((a) => ({
           characterId: a.characterId!,
           role: "attacker",
         })),
     ];

     // 5. Save to database in a transaction
     await prisma.$transaction([
       prisma.killFact.create({
         data: {
           killmailId: esiData.killmail_id,
           killTime: new Date(esiData.killmail_time),
           systemId: esiData.solar_system_id,
           position: esiData.victim.position,
           items: esiData.victim.items,
           victim: { create: victim },
           attackers: { create: attackers },
           characters: {
             create: characterRelations,
           },
         },
       }),
     ]);
   }
   ```

2. **Loss Processing**

   ```typescript
   async function processLoss(killmail: RedisQKillmail) {
     const esiData = await fetchESIKillmail(killmail.killID, killmail.hash);

     await prisma.lossFact.create({
       data: {
         killmailId: esiData.killmail_id,
         characterId: esiData.victim.character_id,
         killTime: new Date(esiData.killmail_time),
         shipTypeId: esiData.victim.ship_type_id,
         systemId: esiData.solar_system_id,
         totalValue: calculateTotalValue(esiData.victim.items),
         attackerCount: esiData.attackers.length,
         attackers: esiData.attackers,
       },
     });
   }
   ```

### Performance Optimizations

1. **Caching**

   - ESI responses cached with TTL
   - Processed data cached in Redis
   - Database query results cached

2. **Batch Processing**

   - Multiple killmails processed in parallel
   - Database transactions for atomicity
   - Retry logic for failed requests

3. **Error Handling**
   - Rate limit handling with backoff
   - Missing data handling
   - Error logging and monitoring

## Best Practices

1. **Database Operations**

   - Use transactions for related operations
   - Implement proper indexing
   - Regular database maintenance

2. **ESI Integration**

   - Respect rate limits
   - Implement caching
   - Handle errors gracefully

3. **Data Consistency**

   - Validate data before storage
   - Maintain referential integrity
   - Regular data cleanup

4. **Performance**
   - Monitor query performance
   - Optimize indexes
   - Use appropriate caching strategies
