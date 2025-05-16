# Project Scripts

This document provides an overview of all available scripts for development, data management, and deployment.

## Data Management

### Database Operations

```bash
# Clear all data from the database
npx prisma db push --force-reset

# Create a new migration
npx prisma migrate dev --name <migration_name>

# Apply migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Reset the database
npm run reset-db

# Run database migrations
npm run migrate

# Migrate map activity data
npm run migrate-map-activity
```

### Character Management

#### Character Data Sync

- **File**: `bot/src/scripts/sync-characters.ts`
- **Purpose**: Synchronize character data from EVE API
- **Usage**:
  ```bash
  npm run sync:characters
  ```

#### Character Group Creation

- **File**: `bot/src/scripts/create-default-groups.ts`
- **Purpose**: Create default character groups based on corporations
- **Usage**:
  ```bash
  npm run create:groups
  ```

### Data Ingestion

#### Killmail Data Sync

- **File**: `bot/src/scripts/sync-kills.ts`
- **Purpose**: Historical killmail backfill from zKillboard
- **Usage**:
  ```bash
  npm run sync:kills
  ```

#### Loss Data Sync

- **File**: `bot/src/scripts/sync-losses.ts`
- **Purpose**: Historical loss data backfill from zKillboard
- **Usage**:
  ```bash
  npm run sync:losses
  ```

#### Map Activity Sync

- **File**: `bot/src/scripts/sync-map-activity.ts`
- **Purpose**: Synchronize map activity data
- **Usage**:
  ```bash
  npm run sync:map-activity
  ```

#### RedisQ Ingestion

- **File**: `bot/src/scripts/start-redisq.ts`
- **Purpose**: Real-time killmail and loss ingestion from RedisQ
- **Usage**:

  ```bash
  # Using PM2
  npm run start

  # Directly
  node dist/scripts/start-redisq.js
  ```

#### General Ingestion

- **File**: `bot/src/scripts/start-ingestion.ts`
- **Purpose**: Start all ingestion processes
- **Usage**:
  ```bash
  # Run directly
  ts-node src/scripts/start-ingestion.ts
  ```

## Development

### TypeScript Compilation

```bash
# Build the project
npm run build

# Run in development mode with auto-reload
npm run dev
```

### Discord Bot Commands

```bash
# Reset all commands
npm run reset:commands

# Register test commands
npm run register:test

# Additional command scripts (run directly with ts-node)
ts-node src/scripts/register-commands.ts        # Register all commands to global scope
ts-node src/scripts/check-commands.ts           # Check registered commands
ts-node src/scripts/register-to-guild.ts        # Register commands to specific guild
ts-node src/scripts/restart-bot.ts              # Restart the bot
```

### Cleanup

- **File**: `bot/src/scripts/cleanup.ts`
- **Purpose**: Clean up temporary files and data
- **Usage**:
  ```bash
  ts-node src/scripts/cleanup.ts
  ```

### Testing

```bash
# Run all tests
npm test

# Test ingestion
npm run test:ingestion

# Test map ingestion
npm run test:map-ingestion

# Test loss ingestion
npm run test:loss-ingestion

# Test Discord integration
npm run test:discord

# Additional test scripts
ts-node src/scripts/test-interaction-handler.ts   # Test Discord interaction handler
```

## Deployment

### PM2 Process Management

The project uses PM2 for process management in production. The configuration is defined in `ecosystem.config.js`:

```bash
# Start all processes
npm run start

# Stop all processes
npm run stop

# Restart all processes
npm run restart

# View logs
npm run logs

# Check status
npm run status
```

#### Process Configuration

The following processes are defined in `ecosystem.config.js`:

1. **redisq-consumer**

   - Script: `dist/scripts/start-redisq.js`
   - Purpose: Real-time killmail and loss ingestion
   - Schedule: Runs continuously

2. **kill-backfill**

   - Script: `dist/scripts/sync-kills.js`
   - Purpose: Daily historical killmail backfill
   - Schedule: Runs daily at midnight (cron: `0 0 * * *`)

3. **loss-backfill**
   - Script: `dist/scripts/sync-losses.js`
   - Purpose: Daily historical loss data backfill
   - Schedule: Runs daily at 1 AM (cron: `0 1 * * *`)

## Environment Setup

### Development Container

- **File**: `.devcontainer/devcontainer.json`
- **Purpose**: Development environment setup
- **Usage**: Open in VS Code with Remote Containers extension

### Environment Variables

- **File**: `.env.example`
- **Purpose**: Environment variable templates
- **Usage**: Copy to `.env` and fill in values

# API Keys

DISCORD_TOKEN=your_discord_token
DISCORD_APP_ID=your_discord_app_id
ZKILLBOARD_API_KEY=your_zkillboard_api_key

# URLs

ZKILLBOARD_API_URL=https://zkillboard.com/api
MAP_API_URL=https://api.eve-map.net
ESI_API_URL=https://esi.evetech.net

# Database

DATABASE_URL=postgresql://user:password@localhost:5432/eve_chart_bot

# Redis

REDIS_URL=redis://localhost:6379
CACHE_TTL=3600

# Rate Limiting

BATCH_SIZE=100
BACKOFF_MS=1000
MAX_RETRIES=3

## Script Reference Table

| Script Name              | File Path                                     | Purpose                             | NPM Command                    |
| ------------------------ | --------------------------------------------- | ----------------------------------- | ------------------------------ |
| Register Commands        | `bot/src/scripts/register-commands.ts`        | Register Discord commands globally  | Manual run                     |
| Register Test Commands   | `bot/src/scripts/register-test-commands.ts`   | Register test commands              | `npm run register:test`        |
| Register to Guild        | `bot/src/scripts/register-to-guild.ts`        | Register commands to specific guild | Manual run                     |
| Check Commands           | `bot/src/scripts/check-commands.ts`           | Check registered commands           | Manual run                     |
| Reset Commands           | `bot/src/scripts/reset-commands.ts`           | Reset all Discord commands          | `npm run reset:commands`       |
| Restart Bot              | `bot/src/scripts/restart-bot.ts`              | Restart Discord bot                 | Manual run                     |
| Start RedisQ             | `bot/src/scripts/start-redisq.ts`             | Start RedisQ consumer               | Via PM2                        |
| Start Ingestion          | `bot/src/scripts/start-ingestion.ts`          | Start all ingestion processes       | Manual run                     |
| Sync Characters          | `bot/src/scripts/sync-characters.ts`          | Sync character data                 | `npm run sync:characters`      |
| Sync Kills               | `bot/src/scripts/sync-kills.ts`               | Sync kill data                      | `npm run sync:kills`           |
| Sync Losses              | `bot/src/scripts/sync-losses.ts`              | Sync loss data                      | `npm run sync:losses`          |
| Sync Map Activity        | `bot/src/scripts/sync-map-activity.ts`        | Sync map activity data              | `npm run sync:map-activity`    |
| Cleanup                  | `bot/src/scripts/cleanup.ts`                  | Clean up temporary data             | Manual run                     |
| Test Ingestion           | `bot/src/scripts/test-ingestion.ts`           | Test ingestion system               | `npm run test:ingestion`       |
| Test Map Ingestion       | `bot/src/scripts/test-map-ingestion.ts`       | Test map ingestion                  | `npm run test:map-ingestion`   |
| Test Loss Ingestion      | `bot/src/scripts/test-loss-ingestion.ts`      | Test loss ingestion                 | `npm run test:loss-ingestion`  |
| Test Discord             | `bot/src/scripts/test-discord.ts`             | Test Discord integration            | `npm run test:discord`         |
| Test Interaction Handler | `bot/src/scripts/test-interaction-handler.ts` | Test interaction handler            | Manual run                     |
| Reset DB                 | `bot/scripts/reset-db.ts`                     | Reset database                      | `npm run reset-db`             |
| Migrate                  | `bot/scripts/migrate.ts`                      | Run migrations                      | `npm run migrate`              |
| Migrate Map Activity     | `bot/scripts/migrate-map-activity.ts`         | Migrate map activity data           | `npm run migrate-map-activity` |
