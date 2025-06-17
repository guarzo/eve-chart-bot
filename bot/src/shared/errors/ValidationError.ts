import { BaseError, ErrorDetails } from './BaseError';

export interface ValidationIssue {
  field: string;
  value: any;
  constraint: string;
  message: string;
}

export class ValidationError extends BaseError {
  public readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[] = [], context?: ErrorDetails['context']) {
    super({
      code: 'VALIDATION_ERROR',
      message,
      statusCode: 400,
      userMessage: 'The provided data is invalid. Please check your input and try again.',
      context,
      isRetryable: false,
      severity: 'medium',
    });

    this.issues = issues;
  }

  static fromZodError(zodError: any, context?: ErrorDetails['context']): ValidationError {
    const issues: ValidationIssue[] =
      zodError.errors?.map((err: any) => ({
        field: err.path.join('.'),
        value: err.received,
        constraint: err.code,
        message: err.message,
      })) || [];

    const message = `Validation failed: ${issues.map(i => i.message).join(', ')}`;

    return new ValidationError(message, issues, context);
  }

  static fieldRequired(field: string, context?: ErrorDetails['context']): ValidationError {
    return new ValidationError(
      `Required field '${field}' is missing`,
      [
        {
          field,
          value: undefined,
          constraint: 'required',
          message: `${field} is required`,
        },
      ],
      context
    );
  }

  static invalidFormat(
    field: string,
    expectedFormat: string,
    actualValue: any,
    context?: ErrorDetails['context']
  ): ValidationError {
    return new ValidationError(
      `Field '${field}' has invalid format`,
      [
        {
          field,
          value: actualValue,
          constraint: 'format',
          message: `${field} must be a valid ${expectedFormat}`,
        },
      ],
      context
    );
  }

  static outOfRange(
    field: string,
    min?: number,
    max?: number,
    actualValue?: any,
    context?: ErrorDetails['context']
  ): ValidationError {
    let message = `${field} is out of range`;
    if (min !== undefined && max !== undefined) {
      message = `${field} must be between ${min} and ${max}`;
    } else if (min !== undefined) {
      message = `${field} must be at least ${min}`;
    } else if (max !== undefined) {
      message = `${field} must be at most ${max}`;
    }

    return new ValidationError(
      message,
      [
        {
          field,
          value: actualValue,
          constraint: 'range',
          message,
        },
      ],
      context
    );
  }

  protected getDefaultUserMessage(): string {
    if (this.issues.length === 1) {
      return `Invalid input: ${this.issues[0].message}`;
    } else if (this.issues.length > 1) {
      return `Multiple validation errors: ${this.issues
        .slice(0, 3)
        .map(i => i.message)
        .join(', ')}${this.issues.length > 3 ? '...' : ''}`;
    }
    return 'The provided data is invalid. Please check your input and try again.';
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      issues: this.issues,
    };
  }

  toApiResponse(): Record<string, any> {
    return {
      error: {
        code: this.code,
        message: this.getUserMessage(),
        correlationId: this.context?.correlationId,
        timestamp: this.timestamp.toISOString(),
        isRetryable: this.isRetryable,
        validationIssues: this.issues.map(issue => ({
          field: issue.field,
          message: issue.message,
          constraint: issue.constraint,
        })),
      },
    };
  }
}
