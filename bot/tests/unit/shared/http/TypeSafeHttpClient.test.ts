import 'reflect-metadata';
import { TypeSafeHttpClient } from '../../../../src/shared/http/TypeSafeHttpClient';
import { logger } from '../../../../src/lib/logger';
import { errorHandler, ExternalServiceError } from '../../../../src/shared/errors';

// Mock dependencies
jest.mock('../../../../src/lib/logger');
jest.mock('../../../../src/shared/errors/ErrorHandler', () => {
  const mockErrorHandler = {
    createCorrelationId: jest.fn(() => 'test-correlation-id'),
    withRetry: jest.fn(async (fn) => await fn()),
    handleError: jest.fn((error) => { throw error; }),
    handleExternalServiceError: jest.fn((error) => { throw error; }),
  };
  
  return {
    ErrorHandler: {
      getInstance: jest.fn(() => mockErrorHandler)
    },
    errorHandler: mockErrorHandler
  };
});

// Mock node-fetch
const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);

describe('TypeSafeHttpClient', () => {
  let client: TypeSafeHttpClient;
  let mockResponse: any;

  const defaultConfig = {
    timeout: 5000,
    maxRetries: 3,
    initialRetryDelay: 1000,
    maxRetryDelay: 30000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: jest.fn(),
      text: jest.fn(),
      headers: new Map([['content-type', 'application/json']]),
    };
    
    mockFetch.mockResolvedValue(mockResponse);
    
    client = new TypeSafeHttpClient('https://api.test.com', defaultConfig);
  });

  describe('constructor', () => {
    it('should initialize with base URL and config', () => {
      expect(client).toBeInstanceOf(TypeSafeHttpClient);
    });

    it('should use default config when not provided', () => {
      const clientWithDefaults = new TypeSafeHttpClient('https://api.test.com');
      expect(clientWithDefaults).toBeInstanceOf(TypeSafeHttpClient);
    });
  });

  describe('get', () => {
    it('should make successful GET request', async () => {
      // Arrange
      const responseData = { data: 'test' };
      mockResponse.json.mockResolvedValue(responseData);

      // Act
      const result = await client.get('/test-endpoint');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/test-endpoint',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object),
        })
      );
      expect(result).toEqual(responseData);
    });

    it('should handle query parameters', async () => {
      // Arrange
      const responseData = { data: 'test' };
      mockResponse.json.mockResolvedValue(responseData);
      const params = { page: 1, limit: 10 };

      // Act
      await client.get('/test-endpoint', { params });

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/test-endpoint?page=1&limit=10',
        expect.any(Object)
      );
    });

    it('should handle custom headers', async () => {
      // Arrange
      const responseData = { data: 'test' };
      mockResponse.json.mockResolvedValue(responseData);
      const headers = { 'Custom-Header': 'value' };

      // Act
      await client.get('/test-endpoint', { headers });

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/test-endpoint',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Custom-Header': 'value',
          }),
        })
      );
    });
  });

  describe('post', () => {
    it('should make successful POST request with JSON body', async () => {
      // Arrange
      const requestData = { name: 'test' };
      const responseData = { id: 1, ...requestData };
      mockResponse.json.mockResolvedValue(responseData);

      // Act
      const result = await client.post('/test-endpoint', requestData);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/test-endpoint',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(requestData),
        })
      );
      expect(result).toEqual(responseData);
    });
  });

  describe('put', () => {
    it('should make successful PUT request', async () => {
      // Arrange
      const requestData = { name: 'updated' };
      const responseData = { id: 1, ...requestData };
      mockResponse.json.mockResolvedValue(responseData);

      // Act
      const result = await client.put('/test-endpoint/1', requestData);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/test-endpoint/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(requestData),
        })
      );
      expect(result).toEqual(responseData);
    });
  });

  describe('delete', () => {
    it('should make successful DELETE request', async () => {
      // Arrange
      mockResponse.json.mockResolvedValue({});

      // Act
      const result = await client.delete('/test-endpoint/1');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/test-endpoint/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result).toEqual({});
    });
  });

  describe('error handling', () => {
    it('should handle HTTP errors', async () => {
      // Arrange
      mockResponse.ok = false;
      mockResponse.status = 404;
      mockResponse.statusText = 'Not Found';
      mockResponse.text.mockResolvedValue('Resource not found');

      // Act & Assert
      await expect(client.get('/not-found')).rejects.toThrow();
      expect(errorHandler.handleExternalServiceError).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      // Arrange
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValue(networkError);

      // Act & Assert
      await expect(client.get('/test-endpoint')).rejects.toThrow();
    });

    it('should handle JSON parsing errors', async () => {
      // Arrange
      mockResponse.json.mockRejectedValue(new Error('Invalid JSON'));

      // Act & Assert
      await expect(client.get('/test-endpoint')).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      // Arrange
      const timeoutClient = new TypeSafeHttpClient('https://api.test.com', {
        ...defaultConfig,
        timeout: 100,
      });
      
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      // Act & Assert
      await expect(timeoutClient.get('/slow-endpoint')).rejects.toThrow();
    });
  });

  describe('retry logic', () => {
    it('should retry on transient errors', async () => {
      // Arrange
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockResponse);
      
      mockResponse.json.mockResolvedValue({ data: 'success' });

      // Act
      const result = await client.get('/test-endpoint');

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ data: 'success' });
    });

    it('should use retry configuration from ErrorHandler', async () => {
      // Arrange
      const retryableFn = jest.fn().mockResolvedValue({ data: 'test' });
      (errorHandler.withRetry as jest.Mock).mockImplementation(async (fn) => {
        return await fn();
      });

      // Act
      await client.get('/test-endpoint');

      // Assert
      expect(errorHandler.withRetry).toHaveBeenCalledWith(
        expect.any(Function),
        defaultConfig.maxRetries,
        defaultConfig.initialRetryDelay,
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          operation: 'http.request',
          metadata: expect.any(Object),
        })
      );
    });
  });

  describe('response parsing', () => {
    it('should handle text responses', async () => {
      // Arrange
      mockResponse.headers.set('content-type', 'text/plain');
      mockResponse.text.mockResolvedValue('Plain text response');

      // Act
      const result = await client.get('/text-endpoint');

      // Assert
      expect(result).toBe('Plain text response');
    });

    it('should handle empty responses', async () => {
      // Arrange
      mockResponse.status = 204;
      mockResponse.json.mockResolvedValue(null);

      // Act
      const result = await client.get('/empty-endpoint');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('URL construction', () => {
    it('should handle relative paths correctly', async () => {
      // Arrange
      mockResponse.json.mockResolvedValue({});

      // Act
      await client.get('relative-path');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/relative-path',
        expect.any(Object)
      );
    });

    it('should handle paths with leading slash', async () => {
      // Arrange
      mockResponse.json.mockResolvedValue({});

      // Act
      await client.get('/absolute-path');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/absolute-path',
        expect.any(Object)
      );
    });
  });
});