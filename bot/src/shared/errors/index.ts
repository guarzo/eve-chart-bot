// Base error types
import { BaseError } from './BaseError';
export { BaseError };
export type { ErrorContext, ErrorDetails } from './BaseError';

// Specific error classes
export { ValidationError } from './ValidationError';
export type { ValidationIssue } from './ValidationError';

export { DatabaseError } from './DatabaseError';
export type { DatabaseOperation } from './DatabaseError';

export { DiscordError } from './DiscordError';
export type { DiscordErrorType } from './DiscordError';

export { ChartError } from './ChartError';
export type { ChartErrorType } from './ChartError';

export { ExternalServiceError } from './ExternalServiceError';
export type { ExternalService } from './ExternalServiceError';

// Error handler
export { ErrorHandler, errorHandler } from './ErrorHandler';
export type { ErrorHandlerOptions } from './ErrorHandler';

// Utility functions
export {
  createCorrelationId,
  isRetryableError,
  getErrorSeverity,
  extractCorrelationId,
  sanitizeErrorMessage,
  isTemporaryError,
  getUserFriendlyMessage,
  formatErrorForLogging,
  shouldAlert,
} from './utils';

// Error middleware for Express
export {
  errorMiddleware,
  correlationMiddleware,
  asyncHandler,
  createDiscordErrorResponse,
  validateRequest,
  rateLimitErrorHandler,
  notFoundHandler,
} from './middleware';

// Legacy compatibility - maintain existing exports for backward compatibility
export class AppError extends BaseError {
  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_SERVER_ERROR', details?: any) {
    super({
      code,
      message,
      statusCode,
      isRetryable: false,
      severity: 'medium',
      context: { metadata: details },
    });
  }

  protected getDefaultUserMessage(): string {
    return 'An application error occurred. Please try again later.';
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication required', details?: any) {
    super({
      code: 'AUTHENTICATION_ERROR',
      message,
      statusCode: 401,
      userMessage: 'Authentication is required to access this resource.',
      isRetryable: false,
      severity: 'medium',
      context: { metadata: details },
    });
  }

  protected getDefaultUserMessage(): string {
    return 'Authentication is required to access this resource.';
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string = 'Not authorized', details?: any) {
    super({
      code: 'AUTHORIZATION_ERROR',
      message,
      statusCode: 403,
      userMessage: 'You are not authorized to perform this action.',
      isRetryable: false,
      severity: 'medium',
      context: { metadata: details },
    });
  }

  protected getDefaultUserMessage(): string {
    return 'You are not authorized to perform this action.';
  }
}

export class NotFoundError extends BaseError {
  constructor(message: string = 'Resource not found', details?: any) {
    super({
      code: 'NOT_FOUND',
      message,
      statusCode: 404,
      userMessage: 'The requested resource was not found.',
      isRetryable: false,
      severity: 'low',
      context: { metadata: details },
    });
  }

  protected getDefaultUserMessage(): string {
    return 'The requested resource was not found.';
  }
}

export class RateLimitError extends BaseError {
  constructor(message: string = 'Rate limit exceeded', details?: any) {
    super({
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      statusCode: 429,
      userMessage: 'Too many requests. Please wait before trying again.',
      isRetryable: true,
      severity: 'medium',
      context: { metadata: details },
    });
  }

  protected getDefaultUserMessage(): string {
    return 'Too many requests. Please wait before trying again.';
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string = 'Configuration error', details?: any) {
    super({
      code: 'CONFIGURATION_ERROR',
      message,
      statusCode: 500,
      userMessage: 'A configuration error occurred. Please contact support.',
      isRetryable: false,
      severity: 'high',
      context: { metadata: details },
    });
  }

  protected getDefaultUserMessage(): string {
    return 'A configuration error occurred. Please contact support.';
  }
}
