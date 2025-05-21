# EVE Chart Bot System Architecture

## Startup Process

### Service Initialization Order

1. **Character Sync Service**

   - Syncs characters from Map API
   - Syncs existing characters from database
   - Updates character information

2. **Killmail Ingestion Service**

   - Initial backfill of all characters
   - Processes historical killmails
   - Updates killmail checkpoints

3. **Map Activity Service**

   - Initial sync of all characters
   - Ingests map activity for last 7 days
   - Updates activity checkpoints

4. **RedisQ Service**

   - Starts RedisQ consumer
   - Polls for new killmails
   - Processes real-time killmail data

5. **Discord Bot** (if token available)
   - Logs in to Discord
   - Registers commands
   - Initializes client

### Service URLs and Rate Limits

#### ZKillboard API

- Base URL: `https://zkillboard.com/api/`
- Rate Limit: 20 requests per minute
- Min delay: 3 seconds between requests
- Max delay: 60 seconds (with exponential backoff)
- Timeout: 15-45 seconds (increases with retries)
- Endpoints:
  - Character Kills: `kills/characterID/${characterId}/`
  - Character Losses: `losses/characterID/${characterId}/`
  - Individual Killmail: `killID/${killId}/`

#### Map API

- Base URL: `https://api.eve-map.net`
- Cache TTL: 300 seconds
- Max retries: 3
- Retry delay: 5000ms

#### ESI API

- Cache TTL: 30 minutes
- Max retries: 3
- Initial retry delay: 1000ms

## Data Ingestion

### RedisQ Ingestion

The RedisQ service processes real-time killmails from zKillboard's RedisQ feed:

1. **Polling Process**

   - Polls `https://redisq.zkillboard.com/listen.php?queueID=eve-chart-bot`
   - 1-second delay between polls
   - 5-second delay after errors

2. **Killmail Processing**

   - Validates killmail data (killID and hash)
   - Checks if any tracked characters are involved
   - Fetches full killmail data from ESI
   - Creates domain entities:
     - KillmailVictim
     - KillmailAttacker
     - Killmail
   - Saves to database
   - Updates metrics

3. **Data Storage**
   - Saves killmail details
   - Tracks victim and attacker information
   - Records system, ship, and value data
   - Updates ingestion checkpoints

### Backfill Process

#### Checkpoint System

- Each character has separate checkpoints for kills and losses
- Checkpoints store:
  - `lastSeenId`: Last processed killmail ID
  - `lastSeenTime`: Timestamp of last processed killmail
- Stored in `ingestion_checkpoints` table

#### Pagination Logic

- Starts from page 1
- Continues until one of these conditions is met:
  - Empty page received (5 consecutive empty pages)
  - Reached max pages (20 pages)
  - Reached max records (500 records)
  - Found records older than cutoff date (default 30 days)
  - Error occurs (404/403 status codes)

#### Date-based Filtering

- Default max age: 30 days
- System calculates cutoff date: `new Date() - maxAgeInDays`
- Stops processing when encountering records older than cutoff

### Killmail vs Lossmail Processing

#### Common Elements

- Both use checkpoints
- Both implement rate limiting
- Both use pagination
- Both filter by date range
- Both use the same retry logic

#### Key Differences

1. **Endpoints**

   - Kills: `kills/characterID/${characterId}/`
   - Losses: `losses/characterID/${characterId}/`

2. **Processing Logic**

   - Kills: Full killmail data ingestion
   - Losses: Simplified loss record creation

3. **Checkpoint Keys**

   - Kills: `kills:${characterId}`
   - Losses: `losses:${characterId}`

4. **Data Storage**
   - Kills: Full killmail details with victim and attacker information
   - Losses: Basic loss information (ship, system, value, etc.)

## Error Handling and Retries

### Rate Limiting

- Exponential backoff for consecutive errors
- Increased delays between requests
- Increased timeouts for retries

### Retry Logic

- Max retries: 3
- Initial retry delay: 5000ms
- Timeout increases with each retry
- Different timeouts for different APIs:
  - ZKillboard: 15 seconds
  - ESI: 30 seconds

### Error Logging

- Detailed error context
- Request/response information
- Stack traces
- Metrics tracking
