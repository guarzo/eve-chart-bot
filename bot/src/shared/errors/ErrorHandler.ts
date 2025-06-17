import { randomUUID } from 'crypto';
import { BaseError, ErrorContext } from './BaseError';
import { ValidationError } from './ValidationError';
import { DatabaseError } from './DatabaseError';
import { DiscordError } from './DiscordError';
// import { ChartError } from './ChartError'; // Not currently used
import { ExternalServiceError } from './ExternalServiceError';
import { logger } from '../../lib/logger';
import { metricsCollector } from '../../infrastructure/monitoring/MetricsCollector';
import { tracingService } from '../../infrastructure/monitoring/TracingService';

export interface ErrorHandlerOptions {
  includeStackTrace?: boolean;
  logErrors?: boolean;
  trackMetrics?: boolean;
  createTrace?: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private readonly defaultOptions: ErrorHandlerOptions = {
    includeStackTrace: process.env.NODE_ENV === 'development',
    logErrors: true,
    trackMetrics: true,
    createTrace: true,
  };

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle any error and convert it to a standardized BaseError
   */
  handleError(error: unknown, context?: Partial<ErrorContext>, options?: ErrorHandlerOptions): BaseError {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const errorContext = this.createErrorContext(context);

    // If it's already a BaseError, just add context and handle it
    if (error instanceof BaseError) {
      const enrichedError = error.withContext(errorContext);
      this.processError(enrichedError, mergedOptions);
      return enrichedError;
    }

    // Convert non-BaseError to BaseError
    const baseError = this.convertToBaseError(error, errorContext);
    this.processError(baseError, mergedOptions);
    return baseError;
  }

  /**
   * Handle Discord command errors specifically
   */
  handleDiscordError(
    error: unknown,
    commandName: string,
    userId: string,
    guildId?: string,
    interactionId?: string,
    options?: ErrorHandlerOptions
  ): BaseError {
    const context: Partial<ErrorContext> = {
      operation: commandName,
      userId,
      guildId,
      metadata: { interactionId },
    };

    return this.handleError(error, context, options);
  }

  /**
   * Handle chart generation errors specifically
   */
  handleChartError(
    error: unknown,
    chartType: string,
    characterIds?: string[],
    dataSize?: number,
    options?: ErrorHandlerOptions
  ): BaseError {
    const context: Partial<ErrorContext> = {
      operation: `chart.${chartType}`,
      metadata: {
        chartType,
        characterIds,
        dataSize,
      },
    };

    return this.handleError(error, context, options);
  }

  /**
   * Handle database errors specifically
   */
  handleDatabaseError(
    error: unknown,
    operation: string,
    table?: string,
    characterId?: string,
    options?: ErrorHandlerOptions
  ): BaseError {
    const context: Partial<ErrorContext> = {
      operation: `db.${operation}`,
      characterId,
      metadata: { table },
    };

    return this.handleError(error, context, options);
  }

  /**
   * Handle external service errors specifically
   */
  handleExternalServiceError(
    error: unknown,
    service: string,
    endpoint?: string,
    options?: ErrorHandlerOptions
  ): BaseError {
    const context: Partial<ErrorContext> = {
      operation: `external.${service}`,
      metadata: { service, endpoint },
    };

    return this.handleError(error, context, options);
  }

  /**
   * Create a correlation ID for request tracking
   */
  createCorrelationId(): string {
    return randomUUID();
  }

  /**
   * Check if an error should be retried
   */
  shouldRetry(error: BaseError, currentAttempt: number, maxAttempts: number = 3): boolean {
    if (currentAttempt >= maxAttempts) {
      return false;
    }

    return error.isRetryable;
  }

  /**
   * Get retry delay in milliseconds with exponential backoff
   */
  getRetryDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): number {
    const delay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
    return Math.min(delay + jitter, maxDelay);
  }

  /**
   * Execute operation with automatic retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000,
    context?: Partial<ErrorContext>
  ): Promise<T> {
    let lastError: BaseError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.handleError(error, {
          ...context,
          metadata: { ...context?.metadata, attempt, maxAttempts },
        });

        if (!this.shouldRetry(lastError, attempt, maxAttempts)) {
          throw lastError;
        }

        if (attempt < maxAttempts) {
          const delay = this.getRetryDelay(attempt, baseDelay);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  private createErrorContext(context?: Partial<ErrorContext>): ErrorContext {
    return {
      correlationId: context?.correlationId || this.createCorrelationId(),
      timestamp: context?.timestamp || new Date(),
      ...context,
    };
  }

  private convertToBaseError(error: unknown, context: ErrorContext): BaseError {
    // Handle specific error types that we can recognize
    if (error instanceof Error) {
      const message = error.message;
      const cause = error;

      // Try to identify error type from message patterns
      if (this.isPrismaError(error)) {
        return this.convertPrismaError(error, context);
      }

      if (this.isDiscordJSError(error)) {
        return this.convertDiscordJSError(error, context);
      }

      if (this.isZodError(error)) {
        return ValidationError.fromZodError(error, context);
      }

      if (this.isAxiosError(error)) {
        return this.convertAxiosError(error, context);
      }

      // Generic error conversion
      return new GenericError(message, context, cause);
    }

    // Handle non-Error objects
    const message = typeof error === 'string' ? error : 'Unknown error occurred';
    return new GenericError(message, context);
  }

  private isPrismaError(error: Error): boolean {
    return error.name.includes('Prisma') || error.message.includes('Prisma') || 'code' in error;
  }

  private convertPrismaError(error: any, context: ErrorContext): DatabaseError {
    const message = error.message || 'Database operation failed';
    const code = error.code;

    switch (code) {
      case 'P2002':
        return DatabaseError.constraintViolation(error.meta?.target || 'unknown', undefined, context, error);
      case 'P2025':
        return DatabaseError.recordNotFound('unknown', 'unknown', context);
      case 'P1008':
        return DatabaseError.timeout('query', undefined, context);
      case 'P1001':
        return DatabaseError.connectionFailed(context, error);
      default:
        return new DatabaseError(message, undefined, undefined, context, error);
    }
  }

  private isDiscordJSError(error: Error): boolean {
    return (
      error.name === 'DiscordAPIError' ||
      error.message.includes('Discord') ||
      ('code' in error && typeof (error as any).code === 'number')
    );
  }

  private convertDiscordJSError(error: any, context: ErrorContext): DiscordError {
    const code = error.code;
    const message = error.message || 'Discord API error';

    if (code === 429) {
      return DiscordError.rateLimitError(error.retry_after || 1000, context);
    }

    if (code >= 50000 && code < 60000) {
      return DiscordError.apiError(code, message, context, error);
    }

    return DiscordError.apiError(code || 0, message, context, error);
  }

  private isZodError(error: Error): boolean {
    return error.name === 'ZodError' || 'issues' in error;
  }

  private isAxiosError(error: Error): boolean {
    return error.name === 'AxiosError' || 'response' in error;
  }

  private convertAxiosError(error: any, context: ErrorContext): ExternalServiceError {
    const status = error.response?.status;
    const message = error.message || 'HTTP request failed';
    const url = error.config?.url;

    // Try to determine the service from the URL
    const service = this.identifyServiceFromUrl(url);

    return new ExternalServiceError(service, message, url, status, context, error);
  }

  private identifyServiceFromUrl(url?: string): ExternalServiceError['service'] {
    if (!url) return 'EXTERNAL_API';

    if (url.includes('esi.evetech.net')) return 'ESI';
    if (url.includes('zkillboard.com')) return 'ZKILL';
    if (url.includes('redis') || url.includes('cache')) return 'REDIS';

    return 'EXTERNAL_API';
  }

  private processError(error: BaseError, options: ErrorHandlerOptions): void {
    // Log the error
    if (options.logErrors) {
      this.logError(error, options.includeStackTrace);
    }

    // Track metrics
    if (options.trackMetrics) {
      this.trackErrorMetrics(error);
    }

    // Create trace
    if (options.createTrace) {
      this.createErrorTrace(error);
    }
  }

  private logError(error: BaseError, includeStackTrace: boolean = false): void {
    const logData = error.toLogFormat();

    if (!includeStackTrace) {
      delete logData.error.stack;
      delete logData.error.cause?.stack;
    }

    switch (error.severity) {
      case 'low':
        logger.info('Error occurred', logData);
        break;
      case 'medium':
        logger.warn('Error occurred', logData);
        break;
      case 'high':
        logger.error('Error occurred', logData);
        break;
      case 'critical':
        logger.fatal('Critical error occurred', logData);
        break;
    }
  }

  private trackErrorMetrics(error: BaseError): void {
    metricsCollector.incrementCounter('errors_total', 1, {
      error_code: error.code,
      error_type: error.constructor.name,
      severity: error.severity,
      retryable: error.isRetryable.toString(),
    });

    // Track error by operation
    if (error.context?.operation) {
      metricsCollector.incrementCounter('operation_errors', 1, {
        operation: error.context.operation,
        error_code: error.code,
      });
    }

    // Track error by user/guild for Discord errors
    if (error instanceof DiscordError) {
      if (error.context?.userId) {
        metricsCollector.incrementCounter('discord_user_errors', 1, {
          user_id: error.context.userId,
          error_code: error.code,
        });
      }
      if (error.context?.guildId) {
        metricsCollector.incrementCounter('discord_guild_errors', 1, {
          guild_id: error.context.guildId,
          error_code: error.code,
        });
      }
    }
  }

  private createErrorTrace(error: BaseError): void {
    const currentSpan = tracingService.getCurrentSpan();

    if (currentSpan) {
      tracingService.addTags(currentSpan, {
        'error.code': error.code,
        'error.type': error.constructor.name,
        'error.severity': error.severity,
        'error.retryable': error.isRetryable,
      });

      tracingService.logToSpan(currentSpan, 'error', error.message, {
        error_code: error.code,
        correlation_id: error.context?.correlationId,
        stack: error.stack,
      });
    }
  }
}

// Generic error class for unrecognized errors
class GenericError extends BaseError {
  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super({
      code: 'GENERIC_ERROR',
      message,
      statusCode: 500,
      userMessage: 'An unexpected error occurred. Please try again.',
      context,
      cause,
      isRetryable: false,
      severity: 'medium',
    });
  }

  protected getDefaultUserMessage(): string {
    return 'An unexpected error occurred. Please try again.';
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();
