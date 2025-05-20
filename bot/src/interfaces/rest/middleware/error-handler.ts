import { Request, Response, NextFunction } from "express";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/errors";
import { captureError } from "../../../lib/sentry";

/**
 * Standard error response format
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Centralized error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
) {
  // Log the error
  logger.error(
    {
      error:
        err instanceof Error
          ? {
              message: err.message,
              name: err.name,
              stack: err.stack,
            }
          : err,
      method: req.method,
      url: req.url,
      query: req.query,
      body: req.body,
      ip: req.ip,
    },
    "Request error"
  );

  // Capture error in Sentry
  captureError(err, {
    method: req.method,
    url: req.url,
    query: req.query,
    body: req.body,
    ip: req.ip,
  });

  // Handle AppError instances
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };

    return res.status(err.statusCode).json(response);
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : err.message,
    },
  };

  return res.status(500).json(response);
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
