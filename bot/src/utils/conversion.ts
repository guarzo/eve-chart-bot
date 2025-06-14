/**
 * Common conversion utilities for domain entities
 */

/**
 * Ensures a value is converted to BigInt, handling string, number, and bigint inputs
 */
export function ensureBigInt(value?: string | number | bigint | null): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') return BigInt(value);
  throw new Error(`Cannot convert ${typeof value} to BigInt`);
}

/**
 * Ensures a value is converted to BigInt, with a required non-null result
 */
export function ensureRequiredBigInt(value?: string | number | bigint | null): bigint {
  const result = ensureBigInt(value);
  if (result === null) {
    throw new Error('Value cannot be null when BigInt is required');
  }
  return result;
}

/**
 * Converts BigInt to string for serialization
 */
export function bigIntToString(value: bigint | null): string | null {
  return value?.toString() ?? null;
}

/**
 * Converts Date to ISO string for serialization, handling null values
 */
export function dateToISOString(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Ensures a value is converted to Date, handling string and Date inputs
 */
export function ensureDate(value: Date | string | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return new Date(value);
}
