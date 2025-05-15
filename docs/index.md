# EVE Online Chart Bot Documentation

Welcome to the EVE Online Chart Bot documentation. This guide will help you understand the architecture, functionality, and usage of the bot.

## Documentation Structure

### Architecture

- [Chart Architecture](./architecture/chart-architecture.md) - Detailed explanation of the charting system architecture
- [Product Requirements](./architecture/prd.md) - Product requirements document

### API

- [Chart Commands](./api/chart-commands.md) - Documentation for chart commands
- [ESI Integration](./api/esi-integration.md) - Documentation for EVE Online ESI API integration

### Database

- [Loss Facts Implementation](./database/loss-facts-implementation.md) - Implementation details for loss facts in the database

### Guides

- [Charts Guide](./guides/charts.md) - Guide for working with charts
- [Scripts Reference](./guides/scripts.md) - Reference for available scripts

## Project Structure

The project follows a layered architecture:

- `src/domain/` – Entities, value objects, pure business logic
- `src/application/` – Use-case services (e.g. `ChartService`, `IngestionService`)
- `src/infrastructure/` – Persistence (Prisma), cache adapters, HTTP clients, messaging
- `src/interfaces/` – REST controllers, Discord handlers, CLI scripts

## Getting Started

1. Install dependencies: `npm install`
2. Set up your environment variables (see `.env.example`)
3. Start the bot: `npm run start`

For more information on specific topics, please refer to the documentation sections linked above.
