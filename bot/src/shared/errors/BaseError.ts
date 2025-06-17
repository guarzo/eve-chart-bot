export interface ErrorContext {
  correlationId?: string;
  userId?: string;
  guildId?: string;
  characterId?: string;
  operation?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface ErrorDetails {
  code: string;
  message: string;
  statusCode: number;
  userMessage?: string;
  context?: ErrorContext;
  cause?: Error;
  isRetryable?: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly userMessage?: string;
  public readonly context?: ErrorContext;
  public readonly cause?: Error;
  public readonly isRetryable: boolean;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  public readonly timestamp: Date;

  constructor(details: ErrorDetails) {
    super(details.message);

    this.name = this.constructor.name;
    this.code = details.code;
    this.statusCode = details.statusCode;
    this.userMessage = details.userMessage;
    this.context = details.context;
    this.cause = details.cause;
    this.isRetryable = details.isRetryable ?? false;
    this.severity = details.severity;
    this.timestamp = details.context?.timestamp || new Date();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging and API responses
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      statusCode: this.statusCode,
      isRetryable: this.isRetryable,
      severity: this.severity,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.userMessage || this.getDefaultUserMessage();
  }

  /**
   * Get error for API response (without sensitive data)
   */
  toApiResponse(): Record<string, any> {
    return {
      error: {
        code: this.code,
        message: this.getUserMessage(),
        correlationId: this.context?.correlationId,
        timestamp: this.timestamp.toISOString(),
        isRetryable: this.isRetryable,
      },
    };
  }

  /**
   * Get error for logging (with full context)
   */
  toLogFormat(): Record<string, any> {
    return {
      error: this.toJSON(),
      level: this.getLogLevel(),
    };
  }

  /**
   * Create a new error with additional context
   */
  withContext(additionalContext: Partial<ErrorContext>): this {
    const newContext = { ...this.context, ...additionalContext };
    const constructor = this.constructor as any;

    return new constructor({
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      userMessage: this.userMessage,
      context: newContext,
      cause: this.cause,
      isRetryable: this.isRetryable,
      severity: this.severity,
    });
  }

  /**
   * Check if error matches a specific code or type
   */
  is(codeOrConstructor: string | typeof BaseError): boolean {
    if (typeof codeOrConstructor === 'string') {
      return this.code === codeOrConstructor;
    }
    return this instanceof codeOrConstructor;
  }

  /**
   * Get default user message based on error type
   */
  protected abstract getDefaultUserMessage(): string;

  /**
   * Get log level based on severity
   */
  private getLogLevel(): string {
    switch (this.severity) {
      case 'low':
        return 'info';
      case 'medium':
        return 'warn';
      case 'high':
        return 'error';
      case 'critical':
        return 'fatal';
      default:
        return 'error';
    }
  }
}
