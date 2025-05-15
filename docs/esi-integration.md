# ESI Integration Requirements

## Killmail Data Model

### Core Models

```prisma
model KillFact {
  killmailId    BigInt   @id
  killTime      DateTime
  systemId      Int
  totalValue    BigInt
  points        Int

  // ESI Data
  position      Json     // {x, y, z} coordinates
  items         Json     // Array of dropped/destroyed items

  // Relationships
  victim        KillVictim?
  attackers     KillAttacker[]
  characters    KillCharacter[]  // Many-to-many with characters

  @@index([killTime])
  @@index([systemId])
  @@map("kills_fact")
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

// Junction table for many-to-many relationship between kills and characters
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

## ESI Integration Requirements

### 1. Data Fetching

1. **Killmail Details**

   - Endpoint: `https://esi.evetech.net/latest/killmails/{killmail_id}/{hash}/`
   - Required for:
     - Attacker details
     - Victim details
     - Item drops
     - Position data

2. **Rate Limiting**
   - ESI has rate limits
   - Implement backoff strategy
   - Cache responses

### 2. Data Processing

1. **Attacker Processing**

   - Count total attackers
   - Identify final blow
   - Calculate damage distribution
   - Track corporation/alliance relationships

2. **Item Processing**

   - Track dropped vs destroyed items
   - Calculate total value
   - Store item details for analysis

3. **Position Data**
   - Store coordinates
   - Enable spatial analysis
   - Support system-based queries

### 3. Integration Points

#### RedisQ Consumer

```typescript
interface RedisQKillmail {
  killID: number;
  hash: string;
  // ... other fields
}

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
    // Add victim if it's a player
    ...(victim.characterId
      ? [
          {
            characterId: victim.characterId,
            role: "victim",
          },
        ]
      : []),
    // Add all attackers
    ...attackers
      .filter((a) => a.characterId) // Only include player attackers
      .map((a) => ({
        characterId: a.characterId!,
        role: "attacker",
      })),
  ];

  // 5. Create KillFact
  const killFact = {
    killmailId: esiData.killmail_id,
    killTime: new Date(esiData.killmail_time),
    systemId: esiData.solar_system_id,
    position: esiData.victim.position,
    items: esiData.victim.items,
    // ... other fields
  };

  // 6. Save to database in a transaction
  await prisma.$transaction([
    // Create the kill
    prisma.killFact.create({
      data: {
        ...killFact,
        victim: { create: victim },
        attackers: { create: attackers },
        characters: {
          create: characterRelations.map((rel) => ({
            characterId: rel.characterId,
            role: rel.role,
          })),
        },
      },
    }),
  ]);
}
```

#### Backfill Service

```typescript
async function backfillKillmail(killmailId: number, hash: string) {
  try {
    const esiData = await fetchESIKillmail(killmailId, hash);
    await processKillmail(esiData);
  } catch (error) {
    if (error.status === 404) {
      // Killmail not found in ESI
      logger.warn(`Killmail ${killmailId} not found in ESI`);
    } else {
      throw error;
    }
  }
}
```

### 4. Performance Considerations

1. **Caching Strategy**

   - Cache ESI responses
   - Cache processed killmail data
   - Implement TTL based on data age

2. **Batch Processing**

   - Process multiple killmails in parallel
   - Use database transactions
   - Implement retry logic

3. **Error Handling**
   - Handle ESI rate limits
   - Handle missing data
   - Log processing errors

### 5. Monitoring

1. **Metrics to Track**

   - ESI request latency
   - Processing time
   - Error rates
   - Cache hit rates

2. **Alerts**
   - High error rates
   - Processing delays
   - Cache misses
   - Rate limit hits

### Benefits of New Model

1. **Better Data Organization**

   - Clear separation of victim and attacker data
   - Proper many-to-many relationship with characters
   - Easier to query for character involvement

2. **Improved Querying**

   - Can easily find all kills a character was involved in
   - Can distinguish between victim and attacker roles
   - Better support for corporation/alliance queries

3. **Future Proofing**
   - Ready for loss facts implementation
   - Better support for advanced analytics
   - Easier to add new relationships

### Migration Considerations

1. **Data Migration**

   - Need to backfill victim data
   - Need to create character relationships
   - May need to update existing queries

2. **Performance Impact**

   - Additional joins for character queries
   - More complex transactions
   - Need to optimize indexes

3. **Application Updates**
   - Update chart generation queries
   - Update API endpoints
   - Update Discord bot commands
