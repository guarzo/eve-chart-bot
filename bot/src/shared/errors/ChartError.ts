import { BaseError, ErrorDetails } from './BaseError';

export type ChartErrorType =
  | 'CHART_GENERATION_ERROR'
  | 'CHART_RENDERING_ERROR'
  | 'CHART_DATA_ERROR'
  | 'CHART_CACHE_ERROR'
  | 'CHART_WORKER_ERROR'
  | 'CHART_CONFIG_ERROR';

export class ChartError extends BaseError {
  public readonly chartType?: string;
  public readonly dataSize?: number;
  public readonly renderingEngine?: string;

  constructor(
    type: ChartErrorType,
    message: string,
    chartType?: string,
    context?: ErrorDetails['context'],
    cause?: Error
  ) {
    const statusCode = ChartError.getStatusCodeForType(type);
    const isRetryable = ChartError.isRetryableError(type);
    const severity = ChartError.getSeverityForType(type);

    super({
      code: type,
      message,
      statusCode,
      context,
      cause,
      isRetryable,
      severity,
    });

    this.chartType = chartType;
    this.dataSize = context?.metadata?.dataSize;
    this.renderingEngine = context?.metadata?.renderingEngine || 'chart.js';
  }

  static generationError(
    chartType: string,
    message: string,
    context?: ErrorDetails['context'],
    cause?: Error
  ): ChartError {
    return new ChartError(
      'CHART_GENERATION_ERROR',
      `Chart generation failed for ${chartType}: ${message}`,
      chartType,
      context,
      cause
    );
  }

  static renderingError(
    chartType: string,
    message: string,
    context?: ErrorDetails['context'],
    cause?: Error
  ): ChartError {
    return new ChartError(
      'CHART_RENDERING_ERROR',
      `Chart rendering failed for ${chartType}: ${message}`,
      chartType,
      context,
      cause
    );
  }

  static dataError(chartType: string, message: string, context?: ErrorDetails['context'], cause?: Error): ChartError {
    return new ChartError(
      'CHART_DATA_ERROR',
      `Chart data error for ${chartType}: ${message}`,
      chartType,
      context,
      cause
    );
  }

  static cacheError(
    operation: string,
    chartType?: string,
    context?: ErrorDetails['context'],
    cause?: Error
  ): ChartError {
    return new ChartError(
      'CHART_CACHE_ERROR',
      `Chart cache ${operation} failed${chartType ? ` for ${chartType}` : ''}`,
      chartType,
      context,
      cause
    );
  }

  static workerError(
    message: string,
    chartType?: string,
    context?: ErrorDetails['context'],
    cause?: Error
  ): ChartError {
    return new ChartError(
      'CHART_WORKER_ERROR',
      `Chart worker error${chartType ? ` for ${chartType}` : ''}: ${message}`,
      chartType,
      context,
      cause
    );
  }

  static configError(chartType: string, parameter: string, context?: ErrorDetails['context']): ChartError {
    return new ChartError(
      'CHART_CONFIG_ERROR',
      `Invalid chart configuration for ${chartType}: ${parameter}`,
      chartType,
      context
    );
  }

  static noDataError(chartType: string, reason: string, context?: ErrorDetails['context']): ChartError {
    return new ChartError('CHART_DATA_ERROR', `No data available for ${chartType} chart: ${reason}`, chartType, context)
      .withUserMessage('No data is available for the requested chart. Try adjusting your filters or time range.')
      .withStatusCode(404)
      .withSeverity('low')
      .withRetryable(false);
  }

  static dataTooLarge(
    chartType: string,
    dataSize: number,
    maxSize: number,
    context?: ErrorDetails['context']
  ): ChartError {
    return new ChartError(
      'CHART_DATA_ERROR',
      `Dataset too large for ${chartType} chart: ${dataSize} records (max: ${maxSize})`,
      chartType,
      { ...context, metadata: { ...context?.metadata, dataSize, maxSize } }
    )
      .withUserMessage(
        `The requested data is too large to process. Please reduce your time range or apply additional filters.`
      )
      .withStatusCode(413)
      .withSeverity('medium')
      .withRetryable(false);
  }

  static workerTimeout(chartType: string, timeout: number, context?: ErrorDetails['context']): ChartError {
    return new ChartError('CHART_WORKER_ERROR', `Chart worker timeout for ${chartType}: ${timeout}ms`, chartType, {
      ...context,
      metadata: { ...context?.metadata, timeout },
    })
      .withUserMessage(
        'Chart generation is taking longer than expected. Please try again or reduce the complexity of your request.'
      )
      .withStatusCode(408)
      .withSeverity('medium')
      .withRetryable(true);
  }

  static memoryError(
    chartType: string,
    memoryUsed: number,
    context?: ErrorDetails['context'],
    cause?: Error
  ): ChartError {
    return new ChartError(
      'CHART_GENERATION_ERROR',
      `Chart generation out of memory for ${chartType}: ${Math.round(memoryUsed / 1024 / 1024)}MB`,
      chartType,
      { ...context, metadata: { ...context?.metadata, memoryUsed } },
      cause
    )
      .withUserMessage(
        'The chart data is too complex to process. Please try reducing the time range or number of characters.'
      )
      .withStatusCode(507)
      .withSeverity('high')
      .withRetryable(false);
  }

  protected getDefaultUserMessage(): string {
    switch (this.code) {
      case 'CHART_GENERATION_ERROR':
        return `Failed to generate the ${this.chartType || 'requested'} chart. Please try again.`;
      case 'CHART_RENDERING_ERROR':
        return `Failed to render the ${this.chartType || 'requested'} chart. Please try again.`;
      case 'CHART_DATA_ERROR':
        return 'There was an issue with the chart data. Please check your parameters and try again.';
      case 'CHART_CACHE_ERROR':
        return 'Chart caching is experiencing issues. Your request may take longer to process.';
      case 'CHART_WORKER_ERROR':
        return `Chart generation is currently unavailable. Please try again in a few moments.`;
      case 'CHART_CONFIG_ERROR':
        return 'Invalid chart configuration. Please check your parameters and try again.';
      default:
        return `Failed to create the ${this.chartType || 'requested'} chart. Please try again.`;
    }
  }

  private static getStatusCodeForType(type: ChartErrorType): number {
    switch (type) {
      case 'CHART_CONFIG_ERROR':
        return 400;
      case 'CHART_DATA_ERROR':
        return 422;
      case 'CHART_GENERATION_ERROR':
      case 'CHART_RENDERING_ERROR':
      case 'CHART_WORKER_ERROR':
        return 500;
      case 'CHART_CACHE_ERROR':
        return 503;
      default:
        return 500;
    }
  }

  private static isRetryableError(type: ChartErrorType): boolean {
    switch (type) {
      case 'CHART_GENERATION_ERROR':
      case 'CHART_RENDERING_ERROR':
      case 'CHART_CACHE_ERROR':
      case 'CHART_WORKER_ERROR':
        return true;
      case 'CHART_DATA_ERROR':
      case 'CHART_CONFIG_ERROR':
        return false;
      default:
        return false;
    }
  }

  private static getSeverityForType(type: ChartErrorType): 'low' | 'medium' | 'high' | 'critical' {
    switch (type) {
      case 'CHART_CONFIG_ERROR':
        return 'low';
      case 'CHART_DATA_ERROR':
      case 'CHART_CACHE_ERROR':
        return 'medium';
      case 'CHART_GENERATION_ERROR':
      case 'CHART_RENDERING_ERROR':
      case 'CHART_WORKER_ERROR':
        return 'high';
      default:
        return 'medium';
    }
  }

  private withUserMessage(userMessage: string): this {
    (this as any).userMessage = userMessage;
    return this;
  }

  private withStatusCode(statusCode: number): this {
    (this as any).statusCode = statusCode;
    return this;
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
      chartType: this.chartType,
      dataSize: this.dataSize,
      renderingEngine: this.renderingEngine,
    };
  }
}
