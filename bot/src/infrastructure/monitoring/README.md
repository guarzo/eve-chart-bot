# Monitoring System

Comprehensive monitoring, metrics collection, and distributed tracing for the EVE Online Discord Bot.

## Features

### Health Checks
- **Health Status**: Overall application health with service-level status
- **Readiness Probe**: Kubernetes-ready endpoint for deployment readiness
- **Liveness Probe**: Basic application liveness check
- **Service Monitoring**: Database, Redis, Discord, and WebSocket health

### Metrics Collection
- **Performance Metrics**: Response times, throughput, error rates
- **System Metrics**: Memory usage, CPU utilization, event loop delay
- **Business Metrics**: Discord commands, chart generation, cache performance
- **Database Metrics**: Query performance, connection pool status

### Distributed Tracing
- **Request Tracing**: End-to-end request tracking with correlation IDs
- **Performance Insights**: Identify bottlenecks across service boundaries
- **Error Context**: Detailed error tracking with full trace context
- **Jaeger Export**: Compatible with Jaeger tracing systems

### Monitoring Server
- **HTTP Endpoints**: RESTful monitoring API
- **Prometheus Format**: Standard metrics export for monitoring tools
- **Real-time Monitoring**: Live metrics and health status
- **Debug Tools**: Memory inspection and garbage collection triggers

## Quick Start

### Basic Setup

```typescript
import { MonitoringIntegration } from './infrastructure/monitoring';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const monitoring = MonitoringIntegration.getInstance(prisma);

// Initialize with default settings
await monitoring.initialize();
```

### Advanced Configuration

```typescript
await monitoring.initialize({
  enableServer: true,           // Enable HTTP monitoring server
  serverPort: 3001,            // Monitoring server port
  enableMetrics: true,         // Enable metrics collection
  enableTracing: true,         // Enable distributed tracing
});
```

## Environment Variables

```bash
# Monitoring server configuration
MONITORING_PORT=3001                    # Port for monitoring server
ENABLE_MONITORING_SERVER=true          # Enable/disable monitoring server

# Metrics configuration
METRICS_RETENTION_MS=3600000           # Metrics retention time (1 hour)
METRICS_CLEANUP_INTERVAL_MS=300000     # Cleanup interval (5 minutes)

# Tracing configuration
TRACING_ENABLED=true                   # Enable/disable tracing
TRACE_RETENTION_MS=3600000             # Trace retention time (1 hour)
MAX_SPANS=10000                        # Maximum spans to keep in memory

# Development debugging
NODE_ENV=development                   # Enable debug endpoints
```

## API Endpoints

### Health Endpoints

#### `GET /health`
Complete health status with all services.

```json
{
  "status": "healthy",
  "timestamp": "2025-06-14T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 45,
      "lastCheck": "2025-06-14T10:30:00.000Z"
    },
    "redis": {
      "status": "healthy", 
      "responseTime": 12,
      "lastCheck": "2025-06-14T10:30:00.000Z"
    }
  },
  "system": {
    "memory": { "rss": 134217728, "heapTotal": 67108864 },
    "cpu": 0.156,
    "loadAverage": [0.5, 0.8, 1.2]
  }
}
```

#### `GET /ready`
Kubernetes readiness probe.

```json
{
  "ready": true,
  "services": ["database", "redis"]
}
```

#### `GET /live`
Kubernetes liveness probe.

```json
{
  "alive": true,
  "uptime": 3600
}
```

### Metrics Endpoints

#### `GET /metrics`
Prometheus-formatted metrics for monitoring tools.

```
# HELP discord_commands_processed_total Total Discord commands processed
# TYPE discord_commands_processed_total counter
discord_commands_processed_total{command="kills",status="success"} 1234

# HELP chart_generation_duration Chart generation duration in milliseconds
# TYPE chart_generation_duration histogram
chart_generation_duration_bucket{le="95",type="kills"} 2456
```

#### `GET /metrics/json`
Detailed metrics snapshot in JSON format.

```json
{
  "timestamp": 1697289600000,
  "metrics": {
    "discord": {
      "commandsProcessed": 1234,
      "commandErrors": 5,
      "averageResponseTime": 245,
      "activeCommands": 3
    },
    "database": {
      "queryCount": 5678,
      "queryErrors": 2,
      "averageQueryTime": 45
    }
  }
}
```

### Tracing Endpoints

#### `GET /traces?traceId=abc123`
Export traces in Jaeger format.

```json
{
  "data": [
    {
      "traceID": "abc123",
      "spanID": "def456",
      "operationName": "discord.command.kills",
      "startTime": 1697289600000000,
      "duration": 250000,
      "tags": [
        {"key": "discord.command", "value": "kills"},
        {"key": "discord.user_id", "value": "123456789"}
      ]
    }
  ]
}
```

#### `GET /traces/stats`
Tracing statistics.

```json
{
  "totalSpans": 1500,
  "activeSpans": 23,
  "completedSpans": 1477,
  "errorSpans": 15,
  "averageDuration": 187.5
}
```

### Cache Management

#### `GET /cache/stats`
Cache performance statistics.

```json
{
  "totalKeys": 1245,
  "chartDataKeys": 456,
  "chartResultKeys": 234,
  "dbQueryKeys": 345,
  "aggregatedDataKeys": 210
}
```

#### `POST /cache/invalidate`
Invalidate cache entries.

```bash
# Invalidate by character IDs
curl -X POST /cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{"type": "character", "characterIds": ["123", "456"]}'

# Invalidate by time range
curl -X POST /cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{"type": "timeRange", "startDate": "2025-06-01", "endDate": "2025-06-14"}'
```

## Integration Examples

### Discord Command Monitoring

```typescript
import { tracingService, metricsCollector } from './infrastructure/monitoring';

export async function handleKillsCommand(interaction: ChatInputCommandInteraction) {
  return tracingService.instrumentDiscordCommand(
    'kills',
    interaction.user.id,
    interaction.guildId || '',
    async (span) => {
      const startTime = Date.now();
      
      try {
        // Process command
        const result = await generateKillsChart(/* params */);
        
        // Record success metrics
        const duration = Date.now() - startTime;
        metricsCollector.recordTiming('discord_command_duration', duration, {
          command: 'kills',
          status: 'success'
        });
        
        return result;
      } catch (error) {
        // Record error metrics
        metricsCollector.incrementCounter('discord_command_errors', 1, {
          command: 'kills'
        });
        
        throw error;
      }
    }
  );
}
```

### Database Operation Monitoring

```typescript
import { tracingService } from './infrastructure/monitoring';

export class KillRepository {
  async getKillsForCharacters(characterIds: bigint[], startDate: Date, endDate: Date) {
    return tracingService.instrumentDatabaseOperation(
      'select',
      'kill_fact',
      async (span) => {
        tracingService.addTags(span, {
          'character_count': characterIds.length,
          'date_range': `${startDate.toISOString()} to ${endDate.toISOString()}`
        });
        
        return this.prisma.killFact.findMany({
          where: {
            characterId: { in: characterIds },
            killTime: { gte: startDate, lte: endDate }
          }
        });
      }
    );
  }
}
```

### Chart Generation Monitoring

```typescript
import { metricsCollector } from './infrastructure/monitoring';

export class ChartService {
  async generateChart(config: ChartConfig): Promise<Buffer> {
    const startTime = Date.now();
    let cacheHit = false;
    
    try {
      // Check cache first
      const cached = await this.getFromCache(config);
      if (cached) {
        cacheHit = true;
        return cached;
      }
      
      // Generate chart
      const result = await this.generateNewChart(config);
      
      // Record metrics
      const duration = Date.now() - startTime;
      metricsCollector.recordTiming('chart_generation_duration', duration, {
        type: config.type,
        cache_hit: 'false'
      });
      
      metricsCollector.incrementCounter('chart_cache_misses', 1, {
        type: config.type
      });
      
      return result;
    } catch (error) {
      metricsCollector.incrementCounter('chart_generation_errors', 1, {
        type: config.type
      });
      throw error;
    } finally {
      if (cacheHit) {
        metricsCollector.incrementCounter('chart_cache_hits', 1, {
          type: config.type
        });
      }
    }
  }
}
```

## Monitoring Tools Integration

### Prometheus + Grafana

1. Configure Prometheus to scrape `/metrics` endpoint
2. Import Grafana dashboards for visualization
3. Set up alerting rules for critical metrics

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'eve-discord-bot'
    static_configs:
      - targets: ['localhost:3001']
    scrape_interval: 30s
    metrics_path: /metrics
```

### Jaeger Tracing

1. Export traces via `/traces` endpoint
2. Configure Jaeger agent for trace collection
3. Use Jaeger UI for trace analysis

### ELK Stack

1. Configure log forwarding to Elasticsearch
2. Use Kibana for log analysis and dashboards
3. Set up log-based alerting

## Performance Impact

- **Memory Usage**: ~10-15MB for metrics and tracing data
- **CPU Overhead**: <1% for metrics collection
- **Network Impact**: Minimal, metrics served on-demand
- **Storage**: Configurable retention periods (default 1 hour)

## Best Practices

1. **Use Correlation IDs**: Track requests across service boundaries
2. **Monitor Error Rates**: Set up alerts for error rate spikes
3. **Track Business Metrics**: Monitor Discord command usage patterns
4. **Cache Performance**: Monitor cache hit rates and invalidation patterns
5. **Resource Utilization**: Track memory and CPU usage trends
6. **Response Times**: Monitor p95 and p99 response times

## Troubleshooting

### High Memory Usage
- Check trace retention settings
- Monitor span count and cleanup intervals
- Review metrics collection frequency

### Missing Metrics
- Verify monitoring integration initialization
- Check middleware setup for Prisma/Discord
- Ensure proper error handling in instrumented code

### Performance Issues
- Review tracing overhead in high-traffic operations
- Consider sampling for high-volume traces
- Optimize metrics collection intervals