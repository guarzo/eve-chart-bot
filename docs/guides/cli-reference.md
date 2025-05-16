# EVE Chart Bot CLI Reference

The EVE Chart Bot includes a comprehensive CLI tool for various tasks. This reference documents all available commands.

## Main Command

```bash
npm run cli <command-group> <command> [options]
```

## Command Groups

The CLI is organized into the following command groups:

- `ingestion` - Commands for data ingestion from EVE Online APIs
- `database` - Commands for database management
- `character` - Commands for character management
- `killmail` - Commands for killmail processing
- `loss` - Commands for loss data processing
- `discord` - Commands for Discord bot management

## Ingestion Commands

### Start RedisQ Ingestion

```bash
npm run cli ingestion start-redisq
```

Starts the RedisQ ingestion service for real-time killmail and loss processing.

### Sync Map Activity

```bash
npm run cli ingestion sync-map-activity
```

Synchronizes map activity data from EVE Online ESI API.

### Sync Kills

```bash
npm run cli ingestion sync-kills
```

Synchronizes killmail data from ZKillboard.

### Sync Losses

```bash
npm run cli ingestion sync-losses
```

Synchronizes loss data from ZKillboard.

### Sync Characters

```bash
npm run cli ingestion sync-characters
```

Synchronizes character data from EVE Online ESI API.

### Test Ingestion

```bash
npm run cli ingestion test
```

Tests the ingestion pipeline.

### Test Map Ingestion

```bash
npm run cli ingestion test-map
```

Tests map activity ingestion specifically.

## Database Commands

### Verify Tables

```bash
npm run cli database verify-tables
```

Verifies that all required database tables exist and are correctly mapped.

### Reset Database

```bash
npm run cli database reset [--force]
```

Resets the database by deleting all data. Use `--force` to skip confirmation.

### Run Migrations

```bash
npm run cli database migrate
```

Runs database migrations to update the schema.

### Cleanup Database

```bash
npm run cli database cleanup
```

Cleans up database issues.

### Test BigInt Serialization

```bash
npm run cli database test-bigint
```

Tests BigInt serialization in the database.

## Character Commands

### Check Character Groups

```bash
npm run cli character check-groups
```

Checks character group assignments.

### Cleanup Groups

```bash
npm run cli character cleanup-groups
```

Cleans up character groups.

### Cleanup Empty Groups

```bash
npm run cli character cleanup-empty-groups
```

Cleans up empty character groups.

### Merge Duplicate Groups

```bash
npm run cli character merge-duplicate-groups
```

Merges duplicate character groups.

### Fix Character Groups

```bash
npm run cli character fix-groups
```

Fixes issues with character groups.

### Create Default Groups

```bash
npm run cli character create-default-groups
```

Creates default character groups.

### Debug Character Groups

```bash
npm run cli character debug-groups
```

Provides debugging information for character groups.

### Remove Character

```bash
npm run remove-character <characterId>
```

Removes a character by its EVE ID and its associated character group if it's the only character in that group.

## Killmail Commands

### Backfill Kill Relations

```bash
npm run cli killmail backfill-relations
```

Backfills kill relation data.

### Check Killmail Details

```bash
npm run cli killmail check-details
```

Checks killmail details.

### Verify Kill Data

```bash
npm run cli killmail verify-data
```

Verifies kill data integrity.

### Fix Kill Relations

```bash
npm run cli killmail fix-relations
```

Fixes kill relation issues.

### Check Solo Kills

```bash
npm run cli killmail check-solo-kills
```

Checks solo kills in the database.

### Fix Solo Kills

```bash
npm run cli killmail fix-solo-kills
```

Fixes solo kill flags in the database.

### Check Actual Solo Kills

```bash
npm run cli killmail check-actual-solo-kills
```

Checks actual solo kills based on attacker data.

## Loss Commands

### Backfill Loss Data

```bash
npm run cli loss backfill
```

Backfills historical loss data from ZKillboard.

### Verify Loss Data

```bash
npm run cli loss verify-data
```

Verifies loss data integrity.

### Check Loss Details

```bash
npm run cli loss check-details
```

Checks loss details and relationships.

### Fix Loss Relations

```bash
npm run cli loss fix-relations
```

Fixes loss relation issues.

### Add Test Losses

```bash
npm run cli loss add-test
```

Adds test loss data to the database.

### Cleanup Loss Data

```bash
npm run cli loss cleanup
```

Cleans up loss data issues.

## Discord Commands

### Register Commands

```bash
npm run cli discord register-commands [--guild]
```

Registers Discord bot commands. Use `--guild` to register commands for a specific guild only.

### Test Bot

```bash
npm run cli discord test
```

Tests the Discord bot functionality.

### Check Permissions

```bash
npm run cli discord check-permissions
```

Checks Discord bot permissions.

## Common Options

Most commands support the following options:

- `--help` - Show help information
- `--debug` - Enable debug logging
- `--dry-run` - Show what would be done without making changes
- `--force` - Skip confirmation prompts

## Examples

### Register Commands for Development

```bash
npm run cli discord register-commands --guild
```

### Reset Database with Force

```bash
npm run cli database reset --force
```

### Debug Character Groups

```bash
npm run cli character debug-groups --debug
```

### Test Ingestion Pipeline

```bash
npm run cli ingestion test --dry-run
```
