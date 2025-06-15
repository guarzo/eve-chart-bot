import { Transform } from 'class-transformer';
import { z } from 'zod';

/**
 * Comprehensive BigInt transformation utility
 * Centralizes all BigInt conversion patterns found throughout the codebase
 */
export class BigIntTransformer {
  /**
   * Convert various input types to BigInt with comprehensive error handling
   */
  static toBigInt(value: unknown): bigint | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'bigint') {
      return value;
    }

    if (typeof value === 'string') {
      try {
        // Handle empty or whitespace strings
        const trimmed = value.trim();
        if (!trimmed) return null;
        
        // Handle decimal strings by truncating to integer part
        const integerPart = trimmed.split('.')[0];
        return BigInt(integerPart);
      } catch (error) {
        throw new Error(`Invalid BigInt string: "${value}"`);
      }
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid BigInt number: ${value}`);
      }
      return BigInt(Math.floor(value));
    }

    throw new Error(`Cannot convert ${typeof value} to BigInt: ${value}`);
  }

  /**
   * Convert to BigInt with required non-null result
   */
  static toRequiredBigInt(value: unknown): bigint {
    const result = this.toBigInt(value);
    if (result === null) {
      throw new Error(`Required BigInt value is null or undefined: ${value}`);
    }
    return result;
  }

  /**
   * Convert BigInt to string for serialization/logging
   */
  static toString(value: bigint | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return value.toString();
  }

  /**
   * Convert BigInt to string with fallback for required fields
   */
  static toRequiredString(value: bigint | null | undefined): string {
    const result = this.toString(value);
    if (result === null) {
      throw new Error(`Required BigInt string is null or undefined: ${value}`);
    }
    return result;
  }

  /**
   * Convert array of BigInt values to string array (for logging)
   */
  static arrayToStringArray(values: (bigint | null | undefined)[]): string[] {
    return values
      .map(value => this.toString(value))
      .filter((str): str is string => str !== null);
  }

  /**
   * Convert array of various types to BigInt array
   */
  static arrayToBigIntArray(values: unknown[]): bigint[] {
    return values
      .map(value => {
        try {
          return this.toBigInt(value);
        } catch {
          return null; // Skip invalid values
        }
      })
      .filter((bigint): bigint is bigint => bigint !== null);
  }

  /**
   * EVE ID specific transformations (character, corporation, alliance IDs)
   */
  static toEveId(value: unknown): bigint {
    const result = this.toRequiredBigInt(value);
    if (result <= 0) {
      throw new Error(`Invalid EVE ID: must be positive, got ${result}`);
    }
    return result;
  }

  /**
   * EVE ID array transformation (common pattern in chart generators)
   */
  static toEveIdArray(values: unknown[]): bigint[] {
    return values.map(value => this.toEveId(value));
  }

  /**
   * ISK value transformation (special handling for currency values)
   */
  static toIskValue(value: unknown): bigint {
    const result = this.toRequiredBigInt(value);
    if (result < 0) {
      throw new Error(`Invalid ISK value: must be non-negative, got ${result}`);
    }
    return result;
  }

  /**
   * Killmail ID transformation (32-bit signed integer from ESI)
   */
  static toKillmailId(value: unknown): bigint {
    const result = this.toRequiredBigInt(value);
    // Killmail IDs are 32-bit signed integers from ESI
    if (result < -2147483648 || result > 2147483647) {
      throw new Error(`Invalid killmail ID: out of 32-bit range, got ${result}`);
    }
    return result;
  }

  // ===== CLASS-TRANSFORMER DECORATORS =====

  /**
   * Standard BigInt to string transformer for class-transformer
   */
  static get stringTransform() {
    return Transform(({ value }) => this.toString(value));
  }

  /**
   * Required BigInt to string transformer
   */
  static get requiredStringTransform() {
    return Transform(({ value }) => this.toRequiredString(value));
  }

  /**
   * BigInt array to string array transformer
   */
  static get stringArrayTransform() {
    return Transform(({ value }) => 
      Array.isArray(value) ? this.arrayToStringArray(value) : value
    );
  }

  // ===== ZOD SCHEMAS =====

  /**
   * Zod schema for optional BigInt
   */
  static get zodSchema() {
    return z.union([
      z.bigint(),
      z.string().transform(val => this.toBigInt(val)),
      z.number().transform(val => this.toBigInt(val)),
      z.null(),
      z.undefined(),
    ]).refine(val => val === null || val === undefined || typeof val === 'bigint');
  }

  /**
   * Zod schema for required BigInt
   */
  static get zodRequiredSchema() {
    return z.union([
      z.bigint(),
      z.string().transform(val => this.toRequiredBigInt(val)),
      z.number().transform(val => this.toRequiredBigInt(val)),
    ]);
  }

  /**
   * EVE ID specific Zod schema
   */
  static get zodEveIdSchema() {
    return z.union([
      z.bigint().positive(),
      z.string().min(1).transform(val => this.toEveId(val)),
      z.number().positive().int().transform(val => this.toEveId(val)),
    ]);
  }

  // ===== DATABASE/API UTILITIES =====

  /**
   * Prepare BigInt for database query (handles Prisma's BigInt requirements)
   */
  static forDatabase(value: unknown): bigint | null {
    return this.toBigInt(value);
  }

  /**
   * Prepare BigInt array for database query
   */
  static arrayForDatabase(values: unknown[]): bigint[] {
    return this.arrayToBigIntArray(values);
  }

  /**
   * Prepare BigInt for JSON serialization
   */
  static forJson(value: bigint | null | undefined): string | null {
    return this.toString(value);
  }

  /**
   * Prepare BigInt for logging (safe string conversion)
   */
  static forLogging(value: bigint | null | undefined): string {
    return this.toString(value) ?? 'null';
  }

  // ===== FORMATTING UTILITIES =====

  /**
   * Format ISK value for display
   */
  static formatIsk(value: bigint | null | undefined): string {
    if (value === null || value === undefined) {
      return '0 ISK';
    }
    
    const num = Number(value);
    if (num >= 1e12) {
      return `${(num / 1e12).toFixed(2)}T ISK`;
    } else if (num >= 1e9) {
      return `${(num / 1e9).toFixed(2)}B ISK`;
    } else if (num >= 1e6) {
      return `${(num / 1e6).toFixed(2)}M ISK`;
    } else if (num >= 1000) {
      return `${(num / 1e3).toFixed(2)}K ISK`;
    } else {
      return `${num.toLocaleString()} ISK`;
    }
  }

  /**
   * Format large numbers for display
   */
  static formatNumber(value: bigint | null | undefined): string {
    if (value === null || value === undefined) {
      return '0';
    }
    return Number(value).toLocaleString();
  }

  // ===== VALIDATION UTILITIES =====

  /**
   * Validate BigInt is within safe JavaScript number range
   */
  static isInSafeRange(value: bigint): boolean {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) && 
           value <= BigInt(Number.MAX_SAFE_INTEGER);
  }

  /**
   * Validate BigInt is a valid EVE ID
   */
  static isValidEveId(value: bigint): boolean {
    return value > 0 && this.isInSafeRange(value);
  }

  /**
   * Validate BigInt array contains only valid EVE IDs
   */
  static areValidEveIds(values: bigint[]): boolean {
    return values.every(value => this.isValidEveId(value));
  }

  // ===== MIGRATION HELPERS =====

  /**
   * Migrate from old conversion patterns to new transformer
   * Helper for refactoring existing code
   */
  static migrateFromLegacyPattern(value: unknown): bigint | null {
    // Handle legacy patterns like: BigInt(value) or value?.toString()
    try {
      return this.toBigInt(value);
    } catch (error) {
      console.warn(`BigIntTransformer migration warning: ${error}`);
      return null;
    }
  }

  /**
   * Batch migrate character IDs (common pattern in chart generators)
   */
  static migrateCharacterIds(characters: { eveId: unknown }[]): bigint[] {
    return characters
      .map(char => this.migrateFromLegacyPattern(char.eveId))
      .filter((id): id is bigint => id !== null);
  }
}