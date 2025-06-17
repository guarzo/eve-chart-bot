# Configuration Migration Guide

## Overview

The application configuration has been upgraded to use TypeScript's `satisfies` operator for compile-time validation. This provides stronger type safety and catches configuration errors at build time rather than runtime.

## Key Changes

### 1. New Configuration Structure

The configuration is now organized in the `/src/config/` directory:

```
src/config/
├── index.ts           # Main export file
├── types.ts           # Type definitions and interfaces
├── validated.ts       # Validated configuration with satisfies operator
└── validation-examples.ts  # Usage examples
```

### 2. Compile-Time Validation

Configuration now uses the `satisfies` operator:

```typescript
export const ValidatedConfiguration = {
  server: {
    port: parseNumber(process.env.PORT, 3000),
    nodeEnv: validateEnvironment(process.env.NODE_ENV ?? 'development'),
  },
  // ... rest of config
} as const satisfies ApplicationConfig;
```

### 3. Type-Safe Enums

String values now use enums from `/src/shared/enums`:

```typescript
// Before
nodeEnv: 'production'
logLevel: 'info'

// After
nodeEnv: Environment.PRODUCTION
logLevel: LogLevel.INFO
```

### 4. Constraint Validation

Numeric values are validated against constraints:

```typescript
port: parseNumber(
  process.env.PORT,
  3000,
  { min: 0, max: 65535 }
)
```

## Migration Steps

### Step 1: Update Import Statements

```typescript
// Before
import { Configuration } from './config';

// After
import { ValidatedConfiguration } from './config/validated';
// or
import { Configuration } from './config'; // Still works for backward compatibility
```

### Step 2: Use Enum Values

```typescript
// Before
if (process.env.NODE_ENV === 'production') {
  // ...
}

// After
import { Environment } from './shared/enums';
if (ValidatedConfiguration.server.nodeEnv === Environment.PRODUCTION) {
  // ...
}
```

### Step 3: Access Nested Configuration

```typescript
// Before
const port = PORT || 3000;
const redisUrl = REDIS_URL;

// After
const port = ValidatedConfiguration.server.port;
const redisUrl = ValidatedConfiguration.redis.url;
```

### Step 4: Update Environment Variable Usage

Environment variables are now parsed and validated centrally:

```typescript
// Before
const timeout = Number(process.env.HTTP_TIMEOUT) || 30000;

// After
const timeout = ValidatedConfiguration.http.timeout; // Already parsed and validated
```

## Benefits

1. **Compile-Time Safety**: Configuration errors are caught during TypeScript compilation
2. **IntelliSense Support**: Full auto-completion for all configuration values
3. **Type Safety**: No more runtime type errors from misconfigured values
4. **Centralized Validation**: All parsing and validation logic in one place
5. **Constraint Checking**: Numeric values are validated against min/max constraints
6. **Enum Safety**: String values use type-safe enums instead of magic strings

## Examples

### Valid Configuration

```typescript
const config = {
  server: {
    port: 3000,
    nodeEnv: Environment.PRODUCTION,
  },
  logging: {
    level: LogLevel.INFO,
  },
  // ... rest of config
} as const satisfies ApplicationConfig;
```

### Invalid Configuration (Compile-Time Error)

```typescript
const config = {
  server: {
    port: '3000', // ❌ Error: Type 'string' is not assignable to type 'number'
    nodeEnv: 'prod', // ❌ Error: Type '"prod"' is not assignable
  },
  logging: {
    level: 'verbose', // ❌ Error: Type '"verbose"' is not assignable
  },
} as const satisfies ApplicationConfig;
```

## Backward Compatibility

The old configuration exports are maintained for backward compatibility:

- `Configuration` object still exists
- Individual exports like `PORT`, `REDIS_URL` still work
- Legacy `config` object is preserved

However, it's recommended to migrate to the new `ValidatedConfiguration` object for better type safety.

## Environment Variables

### New Environment Variables

Some new environment variables have been added with better naming:

- `WEBSOCKET_RECONNECT_INTERVAL_MS` (default: 5000)
- `WEBSOCKET_MAX_RECONNECT_ATTEMPTS` (default: 10)
- `WEBSOCKET_TIMEOUT` (default: 10000)
- `CHART_DEFAULT_WIDTH` (default: 800)
- `CHART_DEFAULT_HEIGHT` (default: 600)
- `JITTER_MAX_MS` (default: 1000)

### Required Environment Variables

The following environment variables should be set:

- `DATABASE_URL` - PostgreSQL connection string
- `DISCORD_BOT_TOKEN` - Discord bot authentication token
- `MAP_API_KEY` - API key for map service

## Troubleshooting

### TypeScript Errors

If you see TypeScript errors after migration:

1. Ensure you're importing from the correct path
2. Check that enum values are imported
3. Verify that all required properties are present
4. Make sure numeric values are within constraints

### Runtime Warnings

The configuration will log warnings for:

- Invalid numeric values outside constraints
- Missing required environment variables
- Invalid enum values (falls back to defaults)

### IDE Support

For best IDE support:

1. Use VS Code with TypeScript extension
2. Enable strict mode in tsconfig.json
3. Use the configuration object directly rather than individual exports