export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_SERVER_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', details?: any) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Not authorized', details?: any) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: any) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', details?: any) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string = 'External service error', details?: any, statusCode: number = 502) {
    super(message, statusCode, 'EXTERNAL_SERVICE_ERROR', details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database error', details?: any) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string = 'Configuration error', details?: any) {
    super(message, 500, 'CONFIGURATION_ERROR', details);
  }
}
