# Character Group Management

This document describes our approach to character group management in the EVE Chart Bot.

## Problem

We identified two issues with character groups:

1. **Empty Groups**: The system was creating character groups without checking if there were characters to associate with them, resulting in many empty groups.
2. **Duplicate Groups**: We were creating a new character group for each user each time we synced, even if their characters already belonged to a group.

## Solution

We've implemented a more robust character group management strategy:

1. **Prevent Empty Groups**: We only create a character group if we have characters to associate with it.
2. **Reuse Existing Groups**: We check if characters already belong to a group before creating a new one.
3. **Group Consolidation**: Characters from the same main character should be in the same group.

## Implementation

### 1. IngestionService Updates

The `syncUserCharacters` method in the `IngestionService` now:

- Checks if any characters in a user's list already belong to a group
- Uses that existing group instead of creating a new one
- Only creates new groups when necessary
- Performs all operations in transactions to ensure data consistency

### 2. Character Group Utilities

The `CharacterGroupUtils` class provides safe methods for group management:

- `createCharacterGroupSafely`: Creates a group only if we have characters for it
- `upsertCharacterGroupSafely`: Updates an existing group or creates a new one safely
- `cleanupEmptyCharacterGroups`: Deletes any empty groups

### 3. Maintenance Scripts

We've created several scripts for managing character groups:

#### Cleanup Scripts

- `cleanup-character-groups.ts`: Removes empty groups and handles duplicate slugs
- `merge-duplicate-groups.ts`: Merges groups that have characters from the same main

#### Diagnostic Scripts

- `check-character-group-assignments.ts`: Analyzes group assignments and detects issues
- `prevent-empty-character-groups.ts`: Demonstrates the safe creation pattern

## Running the Scripts

```bash
# Check current character group assignments
npx ts-node src/scripts/check-character-group-assignments.ts

# Clean up empty groups
npx ts-node src/scripts/cleanup-character-groups.ts

# Merge duplicate groups
npx ts-node src/scripts/merge-duplicate-groups.ts
```

## Best Practices

1. **Always Check First**: Before creating a new group, check if characters already belong to a group.
2. **Use Transactions**: Always use database transactions for group operations to ensure atomicity.
3. **Validate Input**: Verify that you have characters before creating a group.
4. **Clean Up Regularly**: Run the cleanup scripts periodically to maintain database health.

## Monitoring

Monitor the number of character groups compared to the number of characters. A healthy ratio should have:

- No empty groups
- Multiple characters per group
- Characters from the same main in the same group

You can use the `check-character-group-assignments.ts` script to generate these metrics.
