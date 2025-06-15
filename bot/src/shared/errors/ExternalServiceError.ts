import { BaseError, ErrorDetails } from './BaseError';

export type ExternalService = 'ESI' | 'ZKILL' | 'WANDERER' | 'MAP_API' | 'REDIS' | 'EXTERNAL_API' | 'WEBSOCKET';

export class ExternalServiceError extends BaseError {
  public readonly service: ExternalService;
  public readonly endpoint?: string;
  public readonly responseStatus?: number;
  public readonly retryCount?: number;

  constructor(
    service: ExternalService,
    message: string,
    endpoint?: string,
    responseStatus?: number,
    context?: ErrorDetails['context'],
    cause?: Error
  ) {
    const isRetryable = ExternalServiceError.isRetryableStatus(responseStatus);
    const severity = ExternalServiceError.getSeverityForStatus(responseStatus);

    super({
      code: `${service}_ERROR`,
      message,
      statusCode: responseStatus || 502,
      context,
      cause,
      isRetryable,
      severity,
    });

    this.service = service;
    this.endpoint = endpoint;
    this.responseStatus = responseStatus;
    this.retryCount = context?.metadata?.retryCount || 0;
  }

  static esiError(message: string, endpoint?: string, status?: number, context?: ErrorDetails['context'], cause?: Error): ExternalServiceError {
    return new ExternalServiceError('ESI', `ESI API error: ${message}`, endpoint, status, context, cause);
  }

  static zkillError(message: string, endpoint?: string, status?: number, context?: ErrorDetails['context'], cause?: Error): ExternalServiceError {
    return new ExternalServiceError('ZKILL', `zKillboard API error: ${message}`, endpoint, status, context, cause);
  }

  static wandererError(message: string, context?: ErrorDetails['context'], cause?: Error): ExternalServiceError {
    return new ExternalServiceError('WANDERER', `Wanderer WebSocket error: ${message}`, undefined, undefined, context, cause);
  }

  static mapApiError(message: string, endpoint?: string, status?: number, context?: ErrorDetails['context'], cause?: Error): ExternalServiceError {
    return new ExternalServiceError('MAP_API', `Map API error: ${message}`, endpoint, status, context, cause);
  }

  static redisError(message: string, operation?: string, context?: ErrorDetails['context'], cause?: Error): ExternalServiceError {
    return new ExternalServiceError(
      'REDIS',
      `Redis error: ${message}`,
      operation,
      undefined,
      context,
      cause
    );
  }

  static timeout(service: ExternalService, endpoint?: string, timeoutMs?: number, context?: ErrorDetails['context']): ExternalServiceError {
    return new ExternalServiceError(
      service,
      `${service} request timeout${timeoutMs ? ` (${timeoutMs}ms)` : ''}`,
      endpoint,
      408,
      { ...context, metadata: { ...context?.metadata, timeoutMs } }
    );
  }

  static connectionFailed(service: ExternalService, endpoint?: string, context?: ErrorDetails['context'], cause?: Error): ExternalServiceError {
    return new ExternalServiceError(
      service,
      `Failed to connect to ${service}`,
      endpoint,
      503,
      context,
      cause
    );
  }

  static rateLimited(service: ExternalService, retryAfter?: number, context?: ErrorDetails['context']): ExternalServiceError {
    return new ExternalServiceError(
      service,
      `${service} rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ''}`,
      undefined,
      429,
      { ...context, metadata: { ...context?.metadata, retryAfter } }
    );
  }

  static unauthorized(service: ExternalService, endpoint?: string, context?: ErrorDetails['context']): ExternalServiceError {
    return new ExternalServiceError(
      service,
      `Unauthorized access to ${service}`,
      endpoint,
      401,
      context
    ).withSeverity('high').withRetryable(false);
  }

  static serviceUnavailable(service: ExternalService, context?: ErrorDetails['context'], cause?: Error): ExternalServiceError {
    return new ExternalServiceError(
      service,
      `${service} service is currently unavailable`,
      undefined,
      503,
      context,
      cause
    );
  }

  static invalidResponse(service: ExternalService, expected: string, received: string, context?: ErrorDetails['context']): ExternalServiceError {
    return new ExternalServiceError(
      service,
      `Invalid response from ${service}: expected ${expected}, received ${received}`,
      undefined,
      502,
      context
    ).withSeverity('medium').withRetryable(false);
  }

  protected getDefaultUserMessage(): string {
    switch (this.service) {
      case 'ESI':
        return 'EVE Online API is currently experiencing issues. Please try again later.';
      case 'ZKILL':
        return 'zKillboard service is temporarily unavailable. Please try again later.';
      case 'WANDERER':
        return 'Real-time killmail feed is temporarily disrupted. Historical data is still available.';
      case 'MAP_API':
        return 'Map services are temporarily unavailable. Please try again later.';
      case 'REDIS':
        return 'Caching service is experiencing issues. Performance may be degraded.';
      case 'EXTERNAL_API':
        return 'An external service is temporarily unavailable. Please try again later.';
      case 'WEBSOCKET':
        return 'WebSocket connection is experiencing issues. Trying to reconnect automatically.';
      default:
        return 'An external service is experiencing issues. Please try again later.';
    }
  }

  private static isRetryableStatus(status?: number): boolean {
    if (!status) return true; // Network errors are generally retryable
    
    return [
      408, // Request Timeout
      429, // Too Many Requests
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
    ].includes(status);
  }

  private static getSeverityForStatus(status?: number): 'low' | 'medium' | 'high' | 'critical' {
    if (!status) return 'high'; // Network errors
    
    if (status >= 500) return 'high';
    if (status === 429) return 'medium';
    if (status >= 400) return 'medium';
    return 'low';
  }

  private withSeverity(severity: 'low' | 'medium' | 'high' | 'critical'): this {
    (this as any).severity = severity;
    return this;
  }

  private withRetryable(isRetryable: boolean): this {
    (this as any).isRetryable = isRetryable;
    return this;
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      service: this.service,
      endpoint: this.endpoint,
      responseStatus: this.responseStatus,
      retryCount: this.retryCount,
    };
  }

  toApiResponse(): Record<string, any> {
    const response = super.toApiResponse();
    
    if (this.responseStatus === 429) {
      const retryAfter = this.context?.metadata?.retryAfter;
      if (retryAfter) {
        response.error.retryAfter = retryAfter;
      }
    }

    return response;
  }
}