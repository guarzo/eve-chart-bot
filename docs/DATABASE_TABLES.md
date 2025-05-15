# Database Table Handling

This document explains how the application handles database table names and case sensitivity issues between Prisma models and actual database tables.

## Problem

The application was experiencing an issue where it would warn that the `MapActivity` table didn't exist despite it being present in the database. This was caused by a case-sensitivity mismatch between how the code was looking for tables and how Prisma maps model names to actual database tables.

In the Prisma schema, the `MapActivity` model is mapped to the `map_activities` table:

```prisma
model MapActivity {
  characterId   BigInt   @map("character_id")
  timestamp     DateTime
  signatures    Int
  connections   Int
  passages      Int
  allianceId    Int?     @map("alliance_id")
  corporationId Int      @map("corporation_id")

  @@id([characterId, timestamp])
  @@index([characterId, timestamp])
  @@index([corporationId, timestamp])
  @@map("map_activities")
}
```

The application was incorrectly checking for the existence of a table named `"MapActivity"` instead of `"map_activities"`.

## Solution

We implemented the following to solve this issue:

1. Created a `DatabaseUtils` class to handle table name mappings and existence checks
2. Updated the `BaseRepository` class to properly track both model name and actual database table name
3. Modified the `ensureTablesExist` function to use the new utilities
4. Added diagnostic functionality in the `MapActivityRepository` to log the actual table name
5. Created a verification script to check database tables and their mappings

## Usage

The `DatabaseUtils` class provides the following key methods:

### `tableExists(prisma, modelName)`

This method checks if a table exists in the database by:

1. Finding the actual table name from Prisma's internal model mapping
2. Querying the information_schema to check for existence

Example:

```typescript
const exists = await DatabaseUtils.tableExists(prisma, "MapActivity");
```

### `getTableName(prisma, modelName)`

This method retrieves the actual database table name for a given Prisma model:

Example:

```typescript
const tableName = DatabaseUtils.getTableName(prisma, "MapActivity");
// Returns: "map_activities"
```

## Verification

You can run the database table verification script to check all table mappings:

```bash
npm run verify:tables
```

This will:

1. List all tables in the database
2. Check Prisma model to table mappings
3. Verify if each table exists and return row counts

## Best Practices

When working with database tables:

1. Always use the `DatabaseUtils` to check for table existence
2. Be aware that Prisma models often map to differently named database tables
3. When doing raw SQL queries, make sure to use the actual table name, not the model name
4. Run the `verify:tables` script when you suspect database issues
