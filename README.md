# EVE Chart Bot

A Discord bot providing simplified analytics charts for EVE Online activity.

## Overview

EVE Chart Bot analyzes kill and map activity data, generating useful charts via Discord commands. The bot helps players track their performance, monitor group activity, and identify patterns over time.

## Documentation

- [**Product Requirements Document**](docs/prd.md) - Goals, user stories, and requirements
- [**Project Plan**](docs/project-plan.md) - Current status and roadmap
- [**Chart Commands**](docs/chart-commands.md) - Available chart commands and usage

## Technical References

- [**Scripts**](docs/scripts.md) - Project scripts for development and deployment
- [**ESI Integration**](docs/esi-integration.md) - Details about EVE ESI API integration
- [**Loss Facts Implementation**](docs/loss-facts-implementation.md) - Future plans for loss tracking

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/eve-chart-bot.git

# Install dependencies
npm install

# Start the development server
npm run dev
```

## Deployment

```bash
# Build the application
npm run build

# Start all services
npm start
```

### Use Docker Compose

1. Create a `.env` file with the following content:

```
DOCKER_IMAGE=guarzo/eve-chart-bot:latest
DISCORD_TOKEN=your_discord_token
```

2. Start the services:

```bash
docker-compose up -d
```

This will start the bot along with PostgreSQL and Redis services.

### Environment Variables

The following environment variables are required:

- `DOCKER_IMAGE`: The Docker image to use (e.g., `guarzo/eve-chart-bot:latest`)
- `DISCORD_TOKEN`: Your Discord bot token

Optional variables with defaults:

- `API_PORT`: Port for the API (default: 3000)
- `POSTGRES_USER`: PostgreSQL username (default: postgres)
- `POSTGRES_PASSWORD`: PostgreSQL password (default: postgres)
- `POSTGRES_DB`: PostgreSQL database name (default: evechartbot)
- `POSTGRES_PORT`: PostgreSQL port (default: 5432)
- `REDIS_PORT`: Redis port (default: 6379)
- `ENABLE_BACKFILL`: Enable automatic backfill operations when set to "true" (default: false)
- `MAP_NAME`: Map identifier for fetching map data and character lists (required for map features)

The following variables are automatically derived and don't need to be set:

- `DATABASE_URL`: Derived from PostgreSQL settings
- `REDIS_URL`: Derived from Redis settings

### Available Tags

- `latest`: Most recent release
- `x.y.z`: Specific version (e.g., `1.2.3`)
- `x.y`: Latest patch version for a minor release (e.g., `1.2`)

## License

See [LICENSE](LICENSE) file for details.

## Project Structure

- **docs/**: Contains all project documentation

  - **architecture/**: System architecture and design documents
  - **api/**: API documentation
  - **guides/**: User and developer guides
  - **database/**: Database schema and management

- **bot/**: Main application code
  - **src/**: Source code
    - **interfaces/**:
      - **cli/**: Command line interface for all operations
        - **character/**: Character management commands
        - **database/**: Database management commands
        - **discord/**: Discord bot commands
        - **ingestion/**: Data ingestion commands
        - **killmail/**: Killmail processing commands
