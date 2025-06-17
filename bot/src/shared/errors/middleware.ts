import { Request, Response, NextFunction } from 'express';
import { BaseError } from './BaseError';
import { AppError } from './index';
import { errorHandler } from './ErrorHandler';
import { extractCorrelationId } from './utils';

/**
 * Express error middleware for handling standardized errors
 */
export function errorMiddleware(error: unknown, req: Request, res: Response, next: NextFunction): void {
  // Skip if response already sent
  if (res.headersSent) {
    return next(error);
  }

  // Extract correlation ID from request
  const correlationId = extractCorrelationId(
    req.headers as Record<string, string>,
    req.query as Record<string, string>,
    (req as any).correlationId
  );

  // Handle the error with context
  const baseError = errorHandler.handleError(error, {
    correlationId,
    operation: `${req.method} ${req.path}`,
    metadata: {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      body: req.method !== 'GET' ? req.body : undefined,
      query: req.query,
      params: req.params,
    },
  });

  // Set correlation ID in response header
  res.setHeader('X-Correlation-ID', baseError.context?.correlationId || correlationId || 'unknown');

  // Send error response
  const apiResponse = baseError.toApiResponse();
  res.status(baseError.statusCode).json(apiResponse);
}

/**
 * Middleware to add correlation ID to requests
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract or create correlation ID
  const correlationId =
    extractCorrelationId(req.headers as Record<string, string>, req.query as Record<string, string>) ||
    errorHandler.createCorrelationId();

  // Add to request object
  (req as any).correlationId = correlationId;

  // Add to response headers
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}

/**
 * Async error wrapper for Express route handlers
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Create error response for Discord interactions
 */
export function createDiscordErrorResponse(error: BaseError): {
  content: string;
  ephemeral: boolean;
} {
  return {
    content: `❌ ${error.getUserMessage()}${error.context?.correlationId ? `\n\n*Error ID: ${error.context.correlationId}*` : ''}`,
    ephemeral: true,
  };
}

/**
 * Validation middleware for request data
 */
export function validateRequest(schema: any) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Validate request data using schema (Zod, Joi, etc.)
      const validated = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Replace request data with validated data
      req.body = validated.body || req.body;
      req.query = validated.query || req.query;
      req.params = validated.params || req.params;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Rate limiting error handler
 */
export function rateLimitErrorHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
  options?: { windowMs?: number; maxRequests?: number }
): void {
  const correlationId = (req as any).correlationId || errorHandler.createCorrelationId();

  const rateLimitError = new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', {
    correlationId,
    operation: `${req.method} ${req.path}`,
    windowMs: options?.windowMs,
    maxRequests: options?.maxRequests,
    ip: req.ip,
  });

  const apiResponse = rateLimitError.toApiResponse();

  // Add rate limit headers
  if (options?.windowMs) {
    res.setHeader('X-RateLimit-Window', Math.ceil(options.windowMs / 1000));
  }
  if (options?.maxRequests) {
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
  }

  res.status(429).json(apiResponse);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const correlationId = (req as any).correlationId || errorHandler.createCorrelationId();

  const notFoundError = new AppError(`Resource not found: ${req.method} ${req.path}`, 404, 'RESOURCE_NOT_FOUND', {
    correlationId,
    operation: `${req.method} ${req.path}`,
  });

  res.setHeader('X-Correlation-ID', correlationId);
  res.status(404).json(notFoundError.toApiResponse());
}
