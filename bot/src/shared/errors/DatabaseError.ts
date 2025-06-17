import { BaseError, ErrorDetails } from './BaseError';

export type DatabaseOperation = 'create' | 'read' | 'update' | 'delete' | 'query' | 'transaction';

export class DatabaseError extends BaseError {
  public readonly operation?: DatabaseOperation;
  public readonly table?: string;
  public readonly query?: string;

  constructor(
    message: string,
    operation?: DatabaseOperation,
    table?: string,
    context?: ErrorDetails['context'],
    cause?: Error,
    query?: string
  ) {
    super({
      code: 'DATABASE_ERROR',
      message,
      statusCode: 500,
      userMessage: 'A database error occurred. Please try again later.',
      context,
      cause,
      isRetryable: true,
      severity: 'high',
    });

    this.operation = operation;
    this.table = table;
    this.query = query;
  }

  static connectionFailed(context?: ErrorDetails['context'], cause?: Error): DatabaseError {
    return new DatabaseError('Failed to connect to database', undefined, undefined, context, cause).withErrorCode(
      'DATABASE_CONNECTION_FAILED'
    );
  }

  static queryFailed(query: string, table?: string, context?: ErrorDetails['context'], cause?: Error): DatabaseError {
    return new DatabaseError(`Database query failed: ${query}`, 'query', table, context, cause, query).withErrorCode(
      'DATABASE_QUERY_FAILED'
    );
  }

  static transactionFailed(context?: ErrorDetails['context'], cause?: Error): DatabaseError {
    return new DatabaseError('Database transaction failed', 'transaction', undefined, context, cause).withErrorCode(
      'DATABASE_TRANSACTION_FAILED'
    );
  }

  static recordNotFound(table: string, identifier: string, context?: ErrorDetails['context']): DatabaseError {
    return new DatabaseError(`Record not found in ${table}: ${identifier}`, 'read', table, context)
      .withErrorCode('DATABASE_RECORD_NOT_FOUND')
      .withUserMessage('The requested data was not found.')
      .withRetryable(false)
      .withSeverity('medium')
      .withStatusCode(404);
  }

  static constraintViolation(
    constraint: string,
    table?: string,
    context?: ErrorDetails['context'],
    cause?: Error
  ): DatabaseError {
    return new DatabaseError(`Database constraint violation: ${constraint}`, 'create', table, context, cause)
      .withErrorCode('DATABASE_CONSTRAINT_VIOLATION')
      .withUserMessage('The operation conflicts with existing data.')
      .withRetryable(false)
      .withSeverity('medium')
      .withStatusCode(409);
  }

  static timeout(operation: DatabaseOperation, table?: string, context?: ErrorDetails['context']): DatabaseError {
    return new DatabaseError(`Database operation timed out: ${operation}`, operation, table, context)
      .withErrorCode('DATABASE_TIMEOUT')
      .withUserMessage('The database operation took too long. Please try again.')
      .withRetryable(true)
      .withSeverity('medium');
  }

  static deadlock(context?: ErrorDetails['context'], cause?: Error): DatabaseError {
    return new DatabaseError('Database deadlock detected', 'transaction', undefined, context, cause)
      .withErrorCode('DATABASE_DEADLOCK')
      .withUserMessage('A conflict occurred with another operation. Please try again.')
      .withRetryable(true)
      .withSeverity('medium');
  }

  protected getDefaultUserMessage(): string {
    switch (this.code) {
      case 'DATABASE_CONNECTION_FAILED':
        return 'Unable to connect to the database. Please try again later.';
      case 'DATABASE_RECORD_NOT_FOUND':
        return 'The requested data was not found.';
      case 'DATABASE_CONSTRAINT_VIOLATION':
        return 'The operation conflicts with existing data.';
      case 'DATABASE_TIMEOUT':
        return 'The database operation took too long. Please try again.';
      case 'DATABASE_DEADLOCK':
        return 'A conflict occurred with another operation. Please try again.';
      default:
        return 'A database error occurred. Please try again later.';
    }
  }

  private withErrorCode(code: string): this {
    (this as any).code = code;
    return this;
  }

  private withUserMessage(userMessage: string): this {
    (this as any).userMessage = userMessage;
    return this;
  }

  private withRetryable(isRetryable: boolean): this {
    (this as any).isRetryable = isRetryable;
    return this;
  }

  private withSeverity(severity: 'low' | 'medium' | 'high' | 'critical'): this {
    (this as any).severity = severity;
    return this;
  }

  private withStatusCode(statusCode: number): this {
    (this as any).statusCode = statusCode;
    return this;
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      operation: this.operation,
      table: this.table,
      query: this.query ? `${this.query.substring(0, 200)}...` : undefined, // Truncate long queries
    };
  }
}
