import { randomUUID } from 'crypto';
import { BaseError } from './BaseError';

/**
 * Create a new correlation ID for request tracking
 */
export function createCorrelationId(): string {
  return randomUUID();
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof BaseError) {
    return error.isRetryable;
  }

  // For non-BaseError, check common patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Network-related errors are usually retryable
    if (message.includes('timeout') || 
        message.includes('connection') || 
        message.includes('network') ||
        message.includes('econnreset') ||
        message.includes('enotfound')) {
      return true;
    }

    // HTTP status codes that are retryable
    if ('status' in error) {
      const status = (error as any).status;
      return [408, 429, 500, 502, 503, 504].includes(status);
    }
  }

  return false;
}

/**
 * Get error severity level
 */
export function getErrorSeverity(error: unknown): 'low' | 'medium' | 'high' | 'critical' {
  if (error instanceof BaseError) {
    return error.severity;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Critical errors
    if (message.includes('out of memory') || 
        message.includes('fatal') ||
        message.includes('segfault')) {
      return 'critical';
    }

    // High severity errors
    if (message.includes('database') || 
        message.includes('connection') ||
        message.includes('unauthorized') ||
        message.includes('forbidden')) {
      return 'high';
    }

    // Low severity errors
    if (message.includes('validation') || 
        message.includes('not found') ||
        message.includes('invalid')) {
      return 'low';
    }
  }

  return 'medium';
}

/**
 * Extract correlation ID from various sources
 */
export function extractCorrelationId(
  headers?: Record<string, string>,
  query?: Record<string, string>,
  context?: any
): string | undefined {
  // Check headers first
  if (headers) {
    return headers['x-correlation-id'] || 
           headers['correlation-id'] || 
           headers['request-id'];
  }

  // Check query parameters
  if (query) {
    return query.correlationId || query.requestId;
  }

  // Check context object
  if (context) {
    return context.correlationId || 
           context.requestId || 
           context.traceId;
  }

  return undefined;
}

/**
 * Sanitize error message for user display
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove sensitive information patterns
  const sanitized = message
    .replace(/password[^s]*=\s*[^\s]*/gi, 'password=***')
    .replace(/token[^s]*=\s*[^\s]*/gi, 'token=***')
    .replace(/key[^s]*=\s*[^\s]*/gi, 'key=***')
    .replace(/secret[^s]*=\s*[^\s]*/gi, 'secret=***')
    .replace(/api[_-]?key[^s]*=\s*[^\s]*/gi, 'api_key=***')
    .replace(/authorization:\s*[^\s]*/gi, 'authorization: ***');

  return sanitized;
}

/**
 * Check if error indicates a temporary issue
 */
export function isTemporaryError(error: unknown): boolean {
  if (error instanceof BaseError) {
    return error.isRetryable;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    return message.includes('timeout') ||
           message.includes('temporarily') ||
           message.includes('service unavailable') ||
           message.includes('rate limit') ||
           message.includes('busy') ||
           message.includes('overload');
  }

  return false;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof BaseError) {
    return error.getUserMessage();
  }

  if (error instanceof Error) {
    const message = error.message;
    
    // Common error patterns with user-friendly messages
    if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED')) {
      return 'Service is currently unavailable. Please try again later.';
    }
    
    if (message.includes('timeout')) {
      return 'The request timed out. Please try again.';
    }
    
    if (message.includes('rate limit')) {
      return 'Too many requests. Please wait a moment before trying again.';
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return 'Invalid input provided. Please check your data and try again.';
    }
    
    if (message.includes('not found')) {
      return 'The requested resource was not found.';
    }
    
    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return 'You do not have permission to perform this action.';
    }
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(error: unknown, includeStack: boolean = true): Record<string, any> {
  if (error instanceof BaseError) {
    const formatted = error.toLogFormat();
    if (!includeStack) {
      delete formatted.error.stack;
      delete formatted.error.cause?.stack;
    }
    return formatted;
  }

  if (error instanceof Error) {
    return {
      error: {
        name: error.name,
        message: sanitizeErrorMessage(error.message),
        stack: includeStack ? error.stack : undefined,
      },
      level: getErrorSeverity(error),
    };
  }

  return {
    error: {
      message: String(error),
      type: typeof error,
    },
    level: 'medium',
  };
}

/**
 * Check if error should trigger an alert
 */
export function shouldAlert(error: unknown): boolean {
  if (error instanceof BaseError) {
    return error.severity === 'critical' || error.severity === 'high';
  }

  const severity = getErrorSeverity(error);
  return severity === 'critical' || severity === 'high';
}