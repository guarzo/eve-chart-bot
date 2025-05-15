# Loss Facts Implementation Plan

## Phase 1: Data Model & Ingestion

### Data Model

```prisma
model LossFact {
  killmailId    BigInt   @id
  characterId   BigInt
  killTime      DateTime
  shipTypeId    Int
  systemId      Int
  totalValue    BigInt
  attackerCount Int
  labels        String[]

  // Relationships
  character     Character @relation(fields: [characterId], references: [eveId])

  @@index([characterId, killTime])
  @@map("losses_fact")
}
```

### Ingestion Requirements

1. **zKillboard Integration**

   - Add loss tracking to RedisQ consumer
   - Implement loss backfill service
   - Add loss-specific error handling

2. **Data Validation**

   - Validate ship types
   - Validate system IDs
   - Handle missing or malformed data

3. **Performance Considerations**
   - Index optimization for loss queries
   - Caching strategy for loss data
   - Batch processing for historical data


## Phase 4: Testing & Optimization

### 1. Testing

1. **Unit Tests**

   - Test loss data ingestion
   - Test loss chart generation
   - Test API endpoints

2. **Integration Tests**
   - Test loss data flow
   - Test chart generation pipeline
   - Test Discord bot commands

### 2. Performance Optimization

1. **Query Optimization**

   - Optimize loss data queries
   - Implement caching for loss data
   - Optimize chart generation

## Dependencies

1. **External**

   - zKillboard API
   - EVE ESI API (for ship types)

2. **Internal**
   - Existing chart generation service
   - Discord bot framework
   - Database schema updates

## Success Metrics

1. **Data Quality**

   - 99.9% loss data accuracy
   - < 1 minute data ingestion delay
   - < 5% missing data rate

2. **Performance**

   - < 3 second chart generation time
   - < 1 second API response time
   - < 100ms database query time

3. **User Adoption**
   - > 50% of users viewing loss charts
   - > 30% of users using loss commands
   - > 20% increase in bot usage
