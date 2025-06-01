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
# Required environment variables
DISCORD_BOT_TOKEN=your_discord_token
MAP_URL=your_map_url
MAP_NAME=your_map_name
MAP_API_TOKEN=your_map_api_token

# Optional environment variables
NODE_ENV=production  # defaults to "development"
```

2. Start the services:

```bash
docker-compose up -d
```

This will start the bot along with PostgreSQL and Redis services.

### Environment Variables

The following environment variables are required:

- `DISCORD_BOT_TOKEN`: Your Discord bot token
- `MAP_URL`: URL of the map API
- `MAP_NAME`: Name of the map to use
- `MAP_API_TOKEN`: API token for map access

Optional variables:

- `NODE_ENV`: Environment (development/production/test, defaults to "development")

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
