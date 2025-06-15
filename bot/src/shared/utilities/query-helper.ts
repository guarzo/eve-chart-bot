/**
 * Helper functions for building Prisma queries
 */

/**
 * Builds a where filter object for Prisma queries based on a set of filters.
 * Automatically handles date fields by converting them to 'gte' operators.
 *
 * @param filters The filters to apply
 * @returns A where filter object for Prisma
 */
export function buildWhereFilter(filters: Record<string, any>) {
  return Object.entries(filters).reduce(
    (acc, [key, value]) => {
      if (value === undefined || value === null) {
        return acc;
      }

      // Handle date fields
      if (key.toLowerCase().includes('date') && value instanceof Date) {
        acc[key] = { gte: value };
      }
      // Handle array values
      else if (Array.isArray(value)) {
        if (value.length > 0) {
          acc[key] = { in: value };
        }
      }
      // Handle simple values
      else {
        acc[key] = value;
      }

      return acc;
    },
    {} as Record<string, any>
  );
}

/**
 * Builds a pagination object for Prisma queries
 *
 * @param page The page number (1-based)
 * @param pageSize The number of items per page
 * @returns A pagination object with skip and take values
 */
export function buildPagination(page: number = 1, pageSize: number = 10) {
  const skip = (page - 1) * pageSize;
  return {
    skip,
    take: pageSize,
  };
}

/**
 * Utility functions for building query strings and handling URL parameters
 */

/**
 * Build a query string from an object of parameters
 * @param params Object containing query parameters
 * @param options Options for query string building
 * @returns Query string (without leading ?)
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | undefined | null>,
  options: {
    sort?: boolean;
    encodeValues?: boolean;
    skipEmpty?: boolean;
    arrayFormat?: 'brackets' | 'comma' | 'repeat';
  } = {}
): string {
  const { sort = true, encodeValues = true, skipEmpty = true, arrayFormat = 'repeat' } = options;

  // Filter out empty values if requested
  const filteredParams = skipEmpty
    ? Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== '')
    : Object.entries(params).filter(([, value]) => value !== null && value !== undefined);

  // Sort parameters if requested
  const sortedParams = sort ? filteredParams.sort(([a], [b]) => a.localeCompare(b)) : filteredParams;

  // Build query string
  return sortedParams
    .map(([key, value]) => {
      // Handle arrays
      if (Array.isArray(value)) {
        switch (arrayFormat) {
          case 'brackets':
            return value
              .map(v => {
                const encodedKey = encodeValues ? encodeURIComponent(`${key}[]`) : `${key}[]`;
                const encodedValue = encodeValues ? encodeURIComponent(String(v)) : String(v);
                return `${encodedKey}=${encodedValue}`;
              })
              .join('&');
          case 'comma': {
            const encodedKey = encodeValues ? encodeURIComponent(key) : key;
            const encodedValue = encodeValues ? encodeURIComponent(value.join(',')) : value.join(',');
            return `${encodedKey}=${encodedValue}`;
          }
          case 'repeat':
          default:
            return value
              .map(v => {
                const encodedKey = encodeValues ? encodeURIComponent(key) : key;
                const encodedValue = encodeValues ? encodeURIComponent(String(v)) : String(v);
                return `${encodedKey}=${encodedValue}`;
              })
              .join('&');
        }
      }

      const stringValue = String(value);
      const encodedValue = encodeValues ? encodeURIComponent(stringValue) : stringValue;
      const encodedKey = encodeValues ? encodeURIComponent(key) : key;
      return `${encodedKey}=${encodedValue}`;
    })
    .join('&');
}

/**
 * Build a cache key from endpoint and parameters
 * @param prefix Cache key prefix
 * @param endpoint API endpoint
 * @param params Query parameters
 * @param options Cache key building options
 * @returns Cache key string
 */
export function buildCacheKey(
  prefix: string,
  endpoint: string,
  params?: Record<string, any>,
  options: {
    includeTimestamp?: boolean;
    ttl?: number;
    version?: string;
  } = {}
): string {
  const { includeTimestamp = false, version } = options;

  let cacheKey = `${prefix}:${endpoint}`;

  if (version) {
    cacheKey += `:v${version}`;
  }

  if (params && Object.keys(params).length > 0) {
    const queryString = buildQueryString(params, {
      sort: true,
      encodeValues: false,
    });
    cacheKey += `?${queryString}`;
  }

  if (includeTimestamp) {
    cacheKey += `:${Date.now()}`;
  }

  return cacheKey;
}

/**
 * Generate cache key with hash for long parameter lists
 * @param prefix Cache key prefix
 * @param endpoint API endpoint
 * @param params Query parameters
 * @returns Cache key string with hash
 */
export function buildHashedCacheKey(prefix: string, endpoint: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) {
    return `${prefix}:${endpoint}`;
  }

  const queryString = buildQueryString(params, {
    sort: true,
    encodeValues: false,
  });

  // Simple hash function for cache keys
  let hash = 0;
  for (let i = 0; i < queryString.length; i++) {
    const char = queryString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `${prefix}:${endpoint}:${Math.abs(hash).toString(36)}`;
}

/**
 * Parse a query string into an object
 * @param queryString Query string (with or without leading ?)
 * @param options Parsing options
 * @returns Object containing parsed parameters
 */
export function parseQueryString(
  queryString: string,
  options: {
    decodeValues?: boolean;
    arrayFormat?: 'brackets' | 'comma' | 'repeat';
    parseNumbers?: boolean;
    parseBooleans?: boolean;
  } = {}
): Record<string, string | string[] | number | boolean> {
  const { decodeValues = true, arrayFormat = 'repeat', parseNumbers = false, parseBooleans = false } = options;

  const params: Record<string, any> = {};

  // Remove leading ? if present
  const cleanQuery = queryString.startsWith('?') ? queryString.slice(1) : queryString;

  if (!cleanQuery) {
    return params;
  }

  const pairs = cleanQuery.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (!key) continue;

    const decodedKey = decodeValues ? decodeURIComponent(key) : key;
    const decodedValue = value ? (decodeValues ? decodeURIComponent(value) : value) : '';

    // Handle array formats
    if (arrayFormat === 'brackets' && decodedKey.endsWith('[]')) {
      const arrayKey = decodedKey.slice(0, -2);
      if (!params[arrayKey]) {
        params[arrayKey] = [];
      }
      params[arrayKey].push(parseValue(decodedValue, { parseNumbers, parseBooleans }));
    } else if (arrayFormat === 'comma' && decodedValue.includes(',')) {
      params[decodedKey] = decodedValue.split(',').map(v => parseValue(v.trim(), { parseNumbers, parseBooleans }));
    } else if (arrayFormat === 'repeat' && params[decodedKey]) {
      // Convert to array if we see the same key again
      if (!Array.isArray(params[decodedKey])) {
        params[decodedKey] = [params[decodedKey]];
      }
      params[decodedKey].push(parseValue(decodedValue, { parseNumbers, parseBooleans }));
    } else {
      params[decodedKey] = parseValue(decodedValue, {
        parseNumbers,
        parseBooleans,
      });
    }
  }

  return params;
}

/**
 * Parse a string value to appropriate type
 */
function parseValue(
  value: string,
  options: { parseNumbers?: boolean; parseBooleans?: boolean }
): string | number | boolean {
  const { parseNumbers = false, parseBooleans = false } = options;

  if (parseBooleans) {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }

  if (parseNumbers && !isNaN(Number(value)) && value !== '') {
    return Number(value);
  }

  return value;
}

/**
 * Merge multiple parameter objects, with later objects taking precedence
 * @param paramObjects Array of parameter objects to merge
 * @returns Merged parameter object
 */
export function mergeParams(...paramObjects: Array<Record<string, any> | undefined>): Record<string, any> {
  return paramObjects.reduce((merged: Record<string, any>, params) => {
    if (params) {
      return { ...merged, ...params };
    }
    return merged;
  }, {});
}

/**
 * Convert parameters to strings suitable for URL encoding
 * @param params Parameter object
 * @returns Parameter object with string values
 */
export function stringifyParams(params: Record<string, any>): Record<string, string> {
  const stringified: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        stringified[key] = value.join(',');
      } else {
        stringified[key] = String(value);
      }
    }
  }

  return stringified;
}

/**
 * Build URL with query parameters
 * @param baseUrl Base URL
 * @param params Query parameters
 * @param options Query string building options
 * @returns Complete URL with query string
 */
export function buildUrl(
  baseUrl: string,
  params?: Record<string, any>,
  options?: Parameters<typeof buildQueryString>[1]
): string {
  if (!params || Object.keys(params).length === 0) {
    return baseUrl;
  }

  const queryString = buildQueryString(params, options);
  const separator = baseUrl.includes('?') ? '&' : '?';

  return `${baseUrl}${separator}${queryString}`;
}

/**
 * Build URL with path parameters and query parameters
 * @param baseUrl Base URL with path parameter placeholders (e.g., '/api/users/:id')
 * @param pathParams Object containing path parameter values
 * @param queryParams Query parameters
 * @param options Query string building options
 * @returns Complete URL with path and query parameters
 */
export function buildUrlWithPath(
  baseUrl: string,
  pathParams: Record<string, string | number> = {},
  queryParams?: Record<string, any>,
  options?: Parameters<typeof buildQueryString>[1]
): string {
  let url = baseUrl;

  // Replace path parameters
  for (const [key, value] of Object.entries(pathParams)) {
    url = url.replace(`:${key}`, encodeURIComponent(String(value)));
  }

  // Add query parameters
  if (queryParams && Object.keys(queryParams).length > 0) {
    const queryString = buildQueryString(queryParams, options);
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}${queryString}`;
  }

  return url;
}

/**
 * Sanitize parameters by removing undefined/null values and converting to strings
 * @param params Raw parameter object
 * @returns Sanitized parameter object
 */
export function sanitizeParams(params: Record<string, any>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      // Convert BigInt to string
      if (typeof value === 'bigint') {
        sanitized[key] = value.toString();
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(v => (typeof v === 'bigint' ? v.toString() : String(v))).join(',');
      } else {
        sanitized[key] = String(value);
      }
    }
  }

  return sanitized;
}

/**
 * Validate URL format
 * @param url URL to validate
 * @returns True if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL
 * @param url URL to extract domain from
 * @returns Domain string or null if invalid
 */
export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Build pagination metadata
 * @param page Current page number
 * @param pageSize Items per page
 * @param totalItems Total number of items
 * @returns Pagination metadata object
 */
export function buildPaginationMeta(page: number, pageSize: number, totalItems: number) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNext,
    hasPrev,
    nextPage: hasNext ? page + 1 : null,
    prevPage: hasPrev ? page - 1 : null,
  };
}
