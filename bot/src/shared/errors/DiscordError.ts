import { BaseError, ErrorDetails } from './BaseError';

export type DiscordErrorType = 
  | 'COMMAND_ERROR'
  | 'PERMISSION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'API_ERROR'
  | 'INTERACTION_ERROR'
  | 'GUILD_ERROR'
  | 'USER_ERROR';

export class DiscordError extends BaseError {
  public readonly discordCode?: number;
  public readonly commandName?: string;
  public readonly interactionId?: string;

  constructor(
    type: DiscordErrorType,
    message: string,
    discordCode?: number,
    context?: ErrorDetails['context'],
    cause?: Error
  ) {
    const statusCode = DiscordError.getStatusCodeForType(type);
    const isRetryable = DiscordError.isRetryableError(type, discordCode);
    const severity = DiscordError.getSeverityForType(type);

    super({
      code: type,
      message,
      statusCode,
      context,
      cause,
      isRetryable,
      severity,
    });

    this.discordCode = discordCode;
    this.commandName = context?.operation;
    this.interactionId = context?.metadata?.interactionId;
  }

  static commandError(commandName: string, message: string, context?: ErrorDetails['context'], cause?: Error): DiscordError {
    return new DiscordError(
      'COMMAND_ERROR',
      `Command '${commandName}' failed: ${message}`,
      undefined,
      { ...context, operation: commandName },
      cause
    );
  }

  static permissionError(requiredPermission: string, context?: ErrorDetails['context']): DiscordError {
    return new DiscordError(
      'PERMISSION_ERROR',
      `Missing required permission: ${requiredPermission}`,
      undefined,
      context
    );
  }

  static rateLimitError(retryAfter: number, context?: ErrorDetails['context']): DiscordError {
    return new DiscordError(
      'RATE_LIMIT_ERROR',
      `Rate limit exceeded, retry after ${retryAfter}ms`,
      429,
      { ...context, metadata: { ...context?.metadata, retryAfter } }
    );
  }

  static apiError(discordCode: number, message: string, context?: ErrorDetails['context'], cause?: Error): DiscordError {
    return new DiscordError(
      'API_ERROR',
      `Discord API error (${discordCode}): ${message}`,
      discordCode,
      context,
      cause
    );
  }

  static interactionError(interactionId: string, message: string, context?: ErrorDetails['context'], cause?: Error): DiscordError {
    return new DiscordError(
      'INTERACTION_ERROR',
      `Interaction error: ${message}`,
      undefined,
      { ...context, metadata: { ...context?.metadata, interactionId } },
      cause
    );
  }

  static guildNotFound(guildId: string, context?: ErrorDetails['context']): DiscordError {
    return new DiscordError(
      'GUILD_ERROR',
      `Guild not found: ${guildId}`,
      undefined,
      { ...context, guildId }
    );
  }

  static userNotFound(userId: string, context?: ErrorDetails['context']): DiscordError {
    return new DiscordError(
      'USER_ERROR',
      `User not found: ${userId}`,
      undefined,
      { ...context, userId }
    );
  }

  static botMissingPermissions(permissions: string[], context?: ErrorDetails['context']): DiscordError {
    return new DiscordError(
      'PERMISSION_ERROR',
      `Bot missing permissions: ${permissions.join(', ')}`,
      undefined,
      context
    );
  }

  static interactionTimeout(interactionId: string, context?: ErrorDetails['context']): DiscordError {
    return new DiscordError(
      'INTERACTION_ERROR',
      'Interaction timed out',
      undefined,
      { ...context, metadata: { ...context?.metadata, interactionId } }
    );
  }

  protected getDefaultUserMessage(): string {
    switch (this.code) {
      case 'COMMAND_ERROR':
        return `The command '${this.commandName || 'unknown'}' encountered an error. Please try again.`;
      case 'PERMISSION_ERROR':
        return 'You do not have permission to use this command.';
      case 'RATE_LIMIT_ERROR':
        const retryAfter = this.context?.metadata?.retryAfter;
        return `You are being rate limited. Please wait ${retryAfter ? Math.ceil(retryAfter / 1000) : 'a moment'} seconds before trying again.`;
      case 'API_ERROR':
        return 'Discord is experiencing issues. Please try again later.';
      case 'INTERACTION_ERROR':
        return 'There was a problem processing your request. Please try again.';
      case 'GUILD_ERROR':
        return 'This server is not properly configured. Please contact an administrator.';
      case 'USER_ERROR':
        return 'User information could not be found.';
      default:
        return 'A Discord-related error occurred. Please try again.';
    }
  }

  private static getStatusCodeForType(type: DiscordErrorType): number {
    switch (type) {
      case 'PERMISSION_ERROR':
        return 403;
      case 'RATE_LIMIT_ERROR':
        return 429;
      case 'GUILD_ERROR':
      case 'USER_ERROR':
        return 404;
      case 'COMMAND_ERROR':
      case 'INTERACTION_ERROR':
        return 400;
      case 'API_ERROR':
      default:
        return 500;
    }
  }

  private static isRetryableError(type: DiscordErrorType, discordCode?: number): boolean {
    switch (type) {
      case 'RATE_LIMIT_ERROR':
      case 'API_ERROR':
        return true;
      case 'COMMAND_ERROR':
        // Retry if it's a temporary Discord API issue
        return discordCode ? [500, 502, 503, 504].includes(discordCode) : false;
      case 'PERMISSION_ERROR':
      case 'GUILD_ERROR':
      case 'USER_ERROR':
      case 'INTERACTION_ERROR':
      default:
        return false;
    }
  }

  private static getSeverityForType(type: DiscordErrorType): 'low' | 'medium' | 'high' | 'critical' {
    switch (type) {
      case 'PERMISSION_ERROR':
      case 'USER_ERROR':
        return 'low';
      case 'COMMAND_ERROR':
      case 'INTERACTION_ERROR':
      case 'GUILD_ERROR':
        return 'medium';
      case 'RATE_LIMIT_ERROR':
        return 'medium';
      case 'API_ERROR':
        return 'high';
      default:
        return 'medium';
    }
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      discordCode: this.discordCode,
      commandName: this.commandName,
      interactionId: this.interactionId,
    };
  }

  toApiResponse(): Record<string, any> {
    const response = super.toApiResponse();
    
    if (this.code === 'RATE_LIMIT_ERROR') {
      const retryAfter = this.context?.metadata?.retryAfter;
      if (retryAfter) {
        response.error.retryAfter = Math.ceil(retryAfter / 1000);
      }
    }

    return response;
  }
}