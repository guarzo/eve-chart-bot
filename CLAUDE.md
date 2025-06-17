# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Install dependencies
npm install

# Run development server with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

### Testing
```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.test.ts
```

### Database Operations
```bash
# Run database migrations
npm run db:migrate

# Reset database (requires --force flag)
npm run db:reset

# Migrate map activity tables
npm run db:migrate-map
```

### Discord Commands
```bash
# Register Discord slash commands
npm run discord:register

# Check registered commands
npm run discord:check
```

### CLI Tool
```bash
# Access the CLI tool for various operations
npm run cli <command> <subcommand> [options]

# Examples:
npm run cli character list
npm run cli killmail check-ingestion
npm run cli diagnostic check-character-kills
```

## Architecture

This is a Discord bot for EVE Online analytics with the following key components:

### Layered Architecture
- **Domain Layer** (`/bot/src/domain/`): Core business entities (Character, Killmail, MapActivity)
- **Application Layer** (`/bot/src/application/`): Chart rendering logic and use cases
- **Infrastructure Layer** (`/bot/src/infrastructure/`): External integrations (HTTP clients, repositories)
- **Services Layer** (`/bot/src/services/`): Business logic for ingestion and chart generation

### Key Services
- **Discord Bot**: Handles slash commands for generating various charts
- **WebSocket Ingestion**: Real-time killmail ingestion via WandererKills WebSocket
- **Map Activity Service**: Syncs character and activity data from Map API
- **Chart Service**: Generates charts using Chart.js and Canvas
- **Repository Pattern**: Data access through abstracted repositories

### External Dependencies
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for performance optimization
- **Discord**: discord.js for bot functionality
- **Charts**: Chart.js with Canvas for server-side rendering
- **WebSocket**: Phoenix Socket for real-time killmail data
- **Map API**: External API for character and activity data
- **Error Tracking**: Sentry integration
- **Process Management**: PM2 for production

### Chart System
The bot supports multiple chart types through a flexible command system:
- Kills/Losses charts with various time ranges
- Efficiency tracking
- Heat maps for activity visualization
- Top lists and rankings
- Group comparisons

### Environment Configuration
Required environment variables:
- `DISCORD_TOKEN`: Discord bot authentication
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `WANDERER_KILLS_URL`: WebSocket URL for killmail data
- `MAP_NAME`: Map identifier for map-specific features
- `MAP_API_URL`: URL for the Map API
- `MAP_API_KEY`: API key for Map authentication

### Testing Approach
- Unit tests in `/bot/tests/unit/`
- Integration tests in `/bot/tests/integration/`
- Jest with TypeScript support
- Test timeout: 10 seconds
- Force exit enabled to prevent hanging tests