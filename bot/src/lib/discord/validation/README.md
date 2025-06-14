# Discord Command Validation System

This directory contains a comprehensive validation and security system for Discord bot commands.

## Overview

The validation system provides:
- **Zod-based input validation** for all command parameters
- **Rate limiting** per user and per guild
- **Security monitoring** for suspicious patterns
- **Automatic blocking** of abusive users
- **Secure error handling** that doesn't leak sensitive information

## Components

### 1. Schemas (`schemas.ts`)
Defines Zod schemas for validating Discord command inputs:
- Discord ID validation (snowflakes, mentions)
- Command-specific parameter validation
- Type-safe command data extraction

### 2. Rate Limiter (`rateLimiter.ts`)
Implements sliding window rate limiting using Redis:
- Per-user rate limits
- Per-guild rate limits
- Configurable limits for different command types
- Automatic cleanup of expired entries

### 3. Middleware (`middleware.ts`)
Core validation logic:
- Command parameter validation
- Security checks (account age, member duration, username patterns)
- Rate limit enforcement
- Input sanitization
- Command usage logging

### 4. Security Monitor (`securityMonitor.ts`)
Tracks and responds to suspicious activity:
- Pattern detection (command flooding, multi-guild spam, timing patterns)
- Automatic blocking for severe violations
- Activity logging for analysis
- Admin monitoring tools

## Usage

### Basic Handler with Validation

```typescript
import { ValidatedBaseChartHandler } from './ValidatedBaseChartHandler';
import { CommandSchema } from '../validation/schemas';

export class MyHandler extends ValidatedBaseChartHandler {
  protected readonly commandName = 'mycommand';
  
  protected async handleValidated(
    interaction: CommandInteraction,
    validatedData: CommandSchema<'mycommand'>
  ): Promise<void> {
    // validatedData is fully typed and validated
    const time = validatedData.time; // number, guaranteed to be 7, 14, 24, or 30
  }
}
```

### Rate Limit Configuration

```typescript
// Default limits
const rateLimitConfigs = {
  default: { maxRequests: 10, windowMs: 60000 }, // 10/min
  charts: { maxRequests: 5, windowMs: 60000 },   // 5/min for expensive ops
  info: { maxRequests: 20, windowMs: 60000 },    // 20/min for cheap ops
  guild: { maxRequests: 30, windowMs: 60000 },   // 30/min per guild
  suspicious: { maxRequests: 1, windowMs: 300000 } // 1/5min for suspicious users
};
```

### Security Patterns Detected

1. **Account Age**: New accounts (< 7 days) are flagged as suspicious
2. **Member Duration**: Very new guild members (< 10 minutes) are monitored
3. **Username Patterns**: Detects spam/phishing patterns in usernames
4. **Command Flooding**: Excessive command usage triggers stricter limits
5. **Multi-Guild Spam**: Using commands across many guilds rapidly
6. **Timing Patterns**: Bot-like behavior with exact intervals

## Security Best Practices

1. **Never expose internal errors** to users
2. **Log all suspicious activity** for analysis
3. **Use ephemeral messages** for error responses
4. **Sanitize all user inputs** before processing
5. **Implement progressive rate limiting** (stricter for suspicious users)

## Monitoring

Admin commands are available for monitoring security:
- `/security status` - Overall system status
- `/security suspicious` - Recent suspicious activity
- `/security blocked` - Currently blocked users
- `/security unblock <user>` - Manually unblock a user

## Configuration

Environment variables:
- `ADMIN_USER_IDS` - Comma-separated list of Discord user IDs with admin access
- `REDIS_URL` - Redis connection string for rate limiting and security tracking

## Future Improvements

- [ ] Machine learning for pattern detection
- [ ] Configurable security thresholds
- [ ] Webhook notifications for high-severity incidents
- [ ] Distributed rate limiting across multiple bot instances
- [ ] Command-specific security rules