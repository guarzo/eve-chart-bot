# EVE Chart Bot

EVE Chart Bot is a tool for generating charts and visualizations for EVE Online players and groups. It ingests killmail data from zKillboard, processes it, and produces various charts showing player activity, ship usage, etc.

## Architecture

The application follows a layered architecture:

- **Domain Layer** (`src/domain/`) - Core business logic
- **Application Layer** (`src/application/`) - Use cases and services
- **Infrastructure Layer** (`src/infrastructure/`) - External integrations
- **Interfaces Layer** (`src/interfaces/`) - User interfaces

For more details, see [Architecture Overview](./docs/architecture/overview.md).

## Installation

### Prerequisites

- Node.js 16+
- Redis
- PostgreSQL

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the database:
   ```bash
   npx prisma migrate dev
   ```
4. Configure environment variables (copy `.env.example` to `.env` and edit)

## Usage

### CLI Commands

The bot provides several CLI commands:

#### Start the Ingestion Service

```bash
npm run cli ingest
```

Options:

- `--mode` (`-m`): Ingestion mode: `realtime` or `backfill` (default: `realtime`)
- `--character` (`-c`): Character ID to backfill (only used in backfill mode)
- `--days` (`-d`): Number of days to backfill (default: 30)

#### Generate Charts

```bash
npm run cli chart --character 12345
```

Options:

- `--type` (`-t`): Chart type: `ship-usage`, `kills-by-system`, `damage-dealt` (default: `ship-usage`)
- `--character` (`-c`): Character ID
- `--group` (`-g`): Group ID
- `--days` (`-d`): Days of data to include (default: 30)
- `--output` (`-o`): Output file path (default: `./chart.png`)
- `--format` (`-f`): Output format: `png` or `html` (default: `png`)

#### Start the REST API Server

```bash
npm run cli server
```

Options:

- `--port` (`-p`): Port to listen on (default: 3000)

### REST API

The REST API provides endpoints for generating charts:

#### Ship Usage Chart

```
GET /api/charts/ship-usage?characterId=12345&days=30&format=png
```

Parameters:

- `characterId`: Character ID
- `groupId`: Group ID (alternative to characterId)
- `days`: Days of data to include (default: 30)
- `format`: Output format: `json`, `png`, or `html` (default: `json`)

### Docker

You can run the application using Docker.

#### Option 1: Using Docker Run

```bash
# Pull the latest Docker image
docker pull OWNER/eve-chart-bot:latest

# Run the container
docker run -d \
  --name eve-chart-bot \
  -e DATABASE_URL=postgresql://username:password@hostname:port/database \
  -e REDIS_URL=redis://hostname:port \
  -e DISCORD_TOKEN=your_discord_token \
  -e ESI_CLIENT_ID=your_esi_client_id \
  -e ESI_CLIENT_SECRET=your_esi_client_secret \
  -p 3000:3000 \
  OWNER/eve-chart-bot:latest
```

Replace `OWNER` with the GitHub repository owner username.

#### Option 2: Using Docker Compose

For easier deployment with PostgreSQL and Redis included:

1. Navigate to the project root directory (above the `bot` folder)
2. Create a `.env` file with the following content:

```
# Docker image settings
DOCKER_IMAGE=OWNER/eve-chart-bot:latest

# API port mapping
API_PORT=3000

# PostgreSQL settings
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=evechartbot
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/evechartbot

# Redis settings
REDIS_PORT=6379
REDIS_URL=redis://redis:6379

# EVE Online API credentials
ESI_CLIENT_ID=your_esi_client_id
ESI_CLIENT_SECRET=your_esi_client_secret

# Discord settings
DISCORD_TOKEN=your_discord_token
```

3. Start the services:

```bash
docker-compose up -d
```

This will start the bot along with PostgreSQL and Redis services.

Available image tags:

- `latest`: Most recent release
- `x.y.z`: Specific version (e.g., `1.2.3`)
- `x.y`: Latest patch version for minor release (e.g., `1.2`)

## Development

### Testing

Run tests:

```bash
npm test
```

Run linting:

```bash
npm run lint
```

### Project Structure

```
bot/
├── src/
│   ├── domain/           # Core business logic
│   ├── application/      # Services and use cases
│   ├── infrastructure/   # External dependencies
│   └── interfaces/       # User interfaces (CLI, REST, Discord)
├── tests/                # Test files
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── prisma/               # Database schema and migrations
└── docs/                 # Documentation
    └── architecture/     # Architecture documentation
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
