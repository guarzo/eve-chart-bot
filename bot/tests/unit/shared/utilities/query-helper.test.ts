import 'reflect-metadata';
import {
  buildWhereFilter,
  buildPagination,
  buildQueryString,
  buildCacheKey,
  parseQueryString,
  mergeParams,
  buildUrl,
  sanitizeParams,
  isValidUrl,
  buildPaginationMeta,
} from '../../../../src/shared/utilities/query-helper';

describe('query-helper utilities', () => {
  describe('buildWhereFilter', () => {
    it('should build filter for simple values', () => {
      // Arrange
      const filters = { characterId: 123, systemId: 30000142 };

      // Act
      const result = buildWhereFilter(filters);

      // Assert
      expect(result).toEqual({
        characterId: 123,
        systemId: 30000142,
      });
    });

    it('should handle date fields with gte operator', () => {
      // Arrange
      const startDate = new Date('2023-01-01');
      const filters = { startDate, characterId: 123 };

      // Act
      const result = buildWhereFilter(filters);

      // Assert
      expect(result).toEqual({
        startDate: { gte: startDate },
        characterId: 123,
      });
    });

    it('should handle array values with in operator', () => {
      // Arrange
      const filters = { characterIds: [123, 456, 789] };

      // Act
      const result = buildWhereFilter(filters);

      // Assert
      expect(result).toEqual({
        characterIds: { in: [123, 456, 789] },
      });
    });

    it('should skip null and undefined values', () => {
      // Arrange
      const filters = { characterId: 123, systemId: null, allianceId: undefined };

      // Act
      const result = buildWhereFilter(filters);

      // Assert
      expect(result).toEqual({
        characterId: 123,
      });
    });

    it('should handle empty arrays', () => {
      // Arrange
      const filters = { characterIds: [], systemId: 123 };

      // Act
      const result = buildWhereFilter(filters);

      // Assert
      expect(result).toEqual({
        systemId: 123,
      });
    });
  });

  describe('buildPagination', () => {
    it('should build pagination with default values', () => {
      // Act
      const result = buildPagination();

      // Assert
      expect(result).toEqual({
        skip: 0,
        take: 10,
      });
    });

    it('should build pagination for specific page and size', () => {
      // Act
      const result = buildPagination(3, 20);

      // Assert
      expect(result).toEqual({
        skip: 40, // (3 - 1) * 20
        take: 20,
      });
    });

    it('should handle first page', () => {
      // Act
      const result = buildPagination(1, 15);

      // Assert
      expect(result).toEqual({
        skip: 0,
        take: 15,
      });
    });
  });

  describe('buildQueryString', () => {
    it('should build query string from object', () => {
      // Arrange
      const params = { page: 1, limit: 10, search: 'test' };

      // Act
      const result = buildQueryString(params);

      // Assert
      expect(result).toBe('limit=10&page=1&search=test'); // sorted
    });

    it('should handle array values with repeat format', () => {
      // Arrange
      const params = { ids: [1, 2, 3] };

      // Act
      const result = buildQueryString(params);

      // Assert
      expect(result).toBe('ids=1&ids=2&ids=3');
    });

    it('should handle array values with brackets format', () => {
      // Arrange
      const params = { ids: [1, 2, 3] };

      // Act
      const result = buildQueryString(params, { arrayFormat: 'brackets' });

      // Assert
      expect(result).toBe('ids%5B%5D=1&ids%5B%5D=2&ids%5B%5D=3');
    });

    it('should handle array values with comma format', () => {
      // Arrange
      const params = { ids: [1, 2, 3] };

      // Act
      const result = buildQueryString(params, { arrayFormat: 'comma' });

      // Assert
      expect(result).toBe('ids=1%2C2%2C3');
    });

    it('should skip empty values when requested', () => {
      // Arrange
      const params = { page: 1, search: '', filter: null };

      // Act
      const result = buildQueryString(params, { skipEmpty: true });

      // Assert
      expect(result).toBe('page=1');
    });

    it('should not encode values when requested', () => {
      // Arrange
      const params = { search: 'test value' };

      // Act
      const result = buildQueryString(params, { encodeValues: false });

      // Assert
      expect(result).toBe('search=test value');
    });
  });

  describe('buildCacheKey', () => {
    it('should build basic cache key', () => {
      // Act
      const result = buildCacheKey('api', '/users');

      // Assert
      expect(result).toBe('api:/users');
    });

    it('should include version when provided', () => {
      // Act
      const result = buildCacheKey('api', '/users', {}, { version: '1.0' });

      // Assert
      expect(result).toBe('api:/users:v1.0');
    });

    it('should include parameters in key', () => {
      // Arrange
      const params = { page: 1, limit: 10 };

      // Act
      const result = buildCacheKey('api', '/users', params);

      // Assert
      expect(result).toBe('api:/users?limit=10&page=1');
    });

    it('should include timestamp when requested', () => {
      // Arrange
      jest.spyOn(Date, 'now').mockReturnValue(1234567890);

      // Act
      const result = buildCacheKey('api', '/users', {}, { includeTimestamp: true });

      // Assert
      expect(result).toBe('api:/users:1234567890');

      // Cleanup
      jest.restoreAllMocks();
    });
  });

  describe('parseQueryString', () => {
    it('should parse basic query string', () => {
      // Act
      const result = parseQueryString('page=1&limit=10&search=test');

      // Assert
      expect(result).toEqual({
        page: '1',
        limit: '10',
        search: 'test',
      });
    });

    it('should parse query string with leading ?', () => {
      // Act
      const result = parseQueryString('?page=1&limit=10');

      // Assert
      expect(result).toEqual({
        page: '1',
        limit: '10',
      });
    });

    it('should parse numbers when requested', () => {
      // Act
      const result = parseQueryString('page=1&limit=10', { parseNumbers: true });

      // Assert
      expect(result).toEqual({
        page: 1,
        limit: 10,
      });
    });

    it('should parse booleans when requested', () => {
      // Act
      const result = parseQueryString('active=true&deleted=false', { parseBooleans: true });

      // Assert
      expect(result).toEqual({
        active: true,
        deleted: false,
      });
    });

    it('should handle array format with brackets', () => {
      // Act
      const result = parseQueryString('ids%5B%5D=1&ids%5B%5D=2', { arrayFormat: 'brackets' });

      // Assert
      expect(result).toEqual({
        ids: ['1', '2'],
      });
    });
  });

  describe('mergeParams', () => {
    it('should merge multiple parameter objects', () => {
      // Arrange
      const params1 = { page: 1, limit: 10 };
      const params2 = { search: 'test' };
      const params3 = { sort: 'name' };

      // Act
      const result = mergeParams(params1, params2, params3);

      // Assert
      expect(result).toEqual({
        page: 1,
        limit: 10,
        search: 'test',
        sort: 'name',
      });
    });

    it('should handle later objects taking precedence', () => {
      // Arrange
      const params1 = { page: 1, limit: 10 };
      const params2 = { page: 2, search: 'test' };

      // Act
      const result = mergeParams(params1, params2);

      // Assert
      expect(result).toEqual({
        page: 2,
        limit: 10,
        search: 'test',
      });
    });

    it('should handle undefined parameters', () => {
      // Arrange
      const params1 = { page: 1 };
      const params2 = undefined;
      const params3 = { limit: 10 };

      // Act
      const result = mergeParams(params1, params2, params3);

      // Assert
      expect(result).toEqual({
        page: 1,
        limit: 10,
      });
    });
  });

  describe('buildUrl', () => {
    it('should build URL without parameters', () => {
      // Act
      const result = buildUrl('https://api.example.com/users');

      // Assert
      expect(result).toBe('https://api.example.com/users');
    });

    it('should build URL with parameters', () => {
      // Arrange
      const params = { page: 1, limit: 10 };

      // Act
      const result = buildUrl('https://api.example.com/users', params);

      // Assert
      expect(result).toBe('https://api.example.com/users?limit=10&page=1');
    });

    it('should append to existing query string', () => {
      // Arrange
      const params = { search: 'test' };

      // Act
      const result = buildUrl('https://api.example.com/users?sort=name', params);

      // Assert
      expect(result).toBe('https://api.example.com/users?sort=name&search=test');
    });
  });

  describe('sanitizeParams', () => {
    it('should convert values to strings', () => {
      // Arrange
      const params = { 
        id: 123, 
        active: true, 
        bigintId: BigInt(456),
        array: [1, 2, 3],
      };

      // Act
      const result = sanitizeParams(params);

      // Assert
      expect(result).toEqual({
        id: '123',
        active: 'true',
        bigintId: '456',
        array: '1,2,3',
      });
    });

    it('should skip null, undefined, and empty values', () => {
      // Arrange
      const params = { 
        id: 123, 
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        validString: 'test',
      };

      // Act
      const result = sanitizeParams(params);

      // Assert
      expect(result).toEqual({
        id: '123',
        validString: 'test',
      });
    });

    it('should handle arrays with BigInt values', () => {
      // Arrange
      const params = { 
        ids: [BigInt(123), 456, 'test'],
      };

      // Act
      const result = sanitizeParams(params);

      // Assert
      expect(result).toEqual({
        ids: '123,456,test',
      });
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('ftp://files.example.com')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('buildPaginationMeta', () => {
    it('should build pagination metadata', () => {
      // Act
      const result = buildPaginationMeta(2, 10, 25);

      // Assert
      expect(result).toEqual({
        page: 2,
        pageSize: 10,
        totalItems: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
        nextPage: 3,
        prevPage: 1,
      });
    });

    it('should handle first page', () => {
      // Act
      const result = buildPaginationMeta(1, 10, 25);

      // Assert
      expect(result).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
        nextPage: 2,
        prevPage: null,
      });
    });

    it('should handle last page', () => {
      // Act
      const result = buildPaginationMeta(3, 10, 25);

      // Assert
      expect(result).toEqual({
        page: 3,
        pageSize: 10,
        totalItems: 25,
        totalPages: 3,
        hasNext: false,
        hasPrev: true,
        nextPage: null,
        prevPage: 2,
      });
    });

    it('should handle single page', () => {
      // Act
      const result = buildPaginationMeta(1, 10, 5);

      // Assert
      expect(result).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 5,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
        nextPage: null,
        prevPage: null,
      });
    });
  });
});