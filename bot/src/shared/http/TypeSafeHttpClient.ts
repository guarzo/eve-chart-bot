/**
 * Type-safe HTTP client with Zod validation
 * Replaces loose typing with proper runtime validation
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { z } from 'zod';
import { logger } from '../../lib/logger';
import { ExternalServiceError, ValidationError } from '../errors';
import { HttpClientConfig, ApiResponse, ApiErrorResponse } from '../types/api';
import * as crypto from 'crypto';

/**
 * Type-safe HTTP client with runtime validation
 */
export class TypeSafeHttpClient {
  private readonly client: AxiosInstance;
  private readonly config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'User-Agent': 'EVE-Chart-Bot/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    // Add request interceptor for API key if provided
    if (config.apiKey) {
      this.client.interceptors.request.use((request) => {
        if (request.headers) {
          request.headers['Authorization'] = `Bearer ${config.apiKey}`;
        }
        return request;
      });
    }

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const correlationId = crypto.randomUUID();
        logger.error('HTTP request failed', {
          correlationId,
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Make a GET request with type validation
   */
  async get<T>(
    endpoint: string,
    schema: z.ZodSchema<T>,
    params?: Record<string, unknown>,
    options?: AxiosRequestConfig
  ): Promise<T> {
    return this.request('GET', endpoint, schema, { params, ...options });
  }

  /**
   * Make a POST request with type validation
   */
  async post<T>(
    endpoint: string,
    schema: z.ZodSchema<T>,
    data?: unknown,
    options?: AxiosRequestConfig
  ): Promise<T> {
    return this.request('POST', endpoint, schema, { data, ...options });
  }

  /**
   * Make a PUT request with type validation
   */
  async put<T>(
    endpoint: string,
    schema: z.ZodSchema<T>,
    data?: unknown,
    options?: AxiosRequestConfig
  ): Promise<T> {
    return this.request('PUT', endpoint, schema, { data, ...options });
  }

  /**
   * Make a DELETE request with type validation
   */
  async delete<T>(
    endpoint: string,
    schema: z.ZodSchema<T>,
    options?: AxiosRequestConfig
  ): Promise<T> {
    return this.request('DELETE', endpoint, schema, options);
  }

  /**
   * Make a request with automatic retries and validation
   */
  private async request<T>(
    method: string,
    endpoint: string,
    schema: z.ZodSchema<T>,
    options: AxiosRequestConfig = {}
  ): Promise<T> {
    const correlationId = crypto.randomUUID();
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    logger.debug('Making HTTP request', {
      correlationId,
      method,
      url,
      baseURL: this.config.baseURL,
    });

    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const response = await this.client.request({
          method,
          url,
          ...options,
        });

        return this.validateResponse(response, schema, correlationId);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.config.retries) {
          break; // Don't retry on last attempt
        }

        if (this.shouldRetry(error)) {
          const delay = this.calculateRetryDelay(attempt);
          logger.warn('Request failed, retrying', {
            correlationId,
            attempt: attempt + 1,
            maxRetries: this.config.retries,
            delay,
            error: error instanceof Error ? error.message : String(error),
          });
          
          await this.sleep(delay);
        } else {
          break; // Don't retry for non-retryable errors
        }
      }
    }

    throw this.handleRequestError(lastError ?? new Error('Unknown error'), correlationId, method, url);
  }

  /**
   * Validate response data with Zod schema
   */
  private validateResponse<T>(
    response: AxiosResponse,
    schema: z.ZodSchema<T>,
    correlationId: string
  ): T {
    try {
      const validatedData = schema.parse(response.data);
      
      logger.debug('Response validated successfully', {
        correlationId,
        status: response.status,
        dataType: typeof response.data,
      });

      return validatedData;
    } catch (error) {
      logger.error('Response validation failed', {
        correlationId,
        status: response.status,
        validationError: error instanceof z.ZodError ? error.issues : error,
        responseData: typeof response.data === 'object' ? JSON.stringify(response.data).slice(0, 500) : response.data,
      });

      throw ValidationError.fromZodError(
        error as z.ZodError,
        `Invalid response format from ${response.config.url}`
      );
    }
  }

  /**
   * Determine if error is retryable
   */
  private shouldRetry(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      // Retry on network errors or 5xx status codes
      if (!error.response) {
        return true; // Network error
      }
      
      const status = error.response.status;
      return status >= 500 || status === 429; // Server errors or rate limiting
    }
    
    return false; // Don't retry validation or other errors
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return Math.floor(delay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle request errors and convert to appropriate error types
   */
  private handleRequestError(
    error: Error,
    correlationId: string,
    method: string,
    url: string
  ): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0;
      const message = error.response?.data?.message ?? error.message;
      
      return new ExternalServiceError(
        `API Error: ${message}`,
        this.config.baseURL,
        { correlationId, method, url, status }
      );
    }

    return new ExternalServiceError(
      `Network Error: ${error.message}`,
      this.config.baseURL,
      { correlationId, method, url, cause: error }
    );
  }

  /**
   * Get raw response without validation (use sparingly)
   */
  async getRaw(
    endpoint: string,
    options?: AxiosRequestConfig
  ): Promise<unknown> {
    const correlationId = crypto.randomUUID();
    
    try {
      const response = await this.client.get(endpoint, options);
      
      logger.debug('Raw response retrieved', {
        correlationId,
        endpoint,
        status: response.status,
      });

      return response.data;
    } catch (error) {
      throw this.handleRequestError(
        error as Error,
        correlationId,
        'GET',
        endpoint
      );
    }
  }
}