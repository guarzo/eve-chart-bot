import {
  ensureBigInt,
  ensureRequiredBigInt,
  formatBigInt,
  parseStringId,
  safeParseInt,
  formatPercentage,
} from '../../../../src/shared/utilities/conversion';

describe('conversion utilities', () => {
  describe('ensureBigInt', () => {
    it('should convert string to BigInt', () => {
      expect(ensureBigInt('123456789')).toBe(BigInt('123456789'));
    });

    it('should convert number to BigInt', () => {
      expect(ensureBigInt(123456)).toBe(BigInt('123456'));
    });

    it('should return existing BigInt', () => {
      const bigIntValue = BigInt('999999999');
      expect(ensureBigInt(bigIntValue)).toBe(bigIntValue);
    });

    it('should return null for null input', () => {
      expect(ensureBigInt(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(ensureBigInt(undefined)).toBeNull();
    });

    it('should return null for invalid string', () => {
      expect(ensureBigInt('invalid')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(ensureBigInt('')).toBeNull();
    });

    it('should handle zero', () => {
      expect(ensureBigInt(0)).toBe(BigInt('0'));
      expect(ensureBigInt('0')).toBe(BigInt('0'));
    });

    it('should handle negative numbers', () => {
      expect(ensureBigInt(-123)).toBe(BigInt('-123'));
      expect(ensureBigInt('-456')).toBe(BigInt('-456'));
    });
  });

  describe('ensureRequiredBigInt', () => {
    it('should convert valid values to BigInt', () => {
      expect(ensureRequiredBigInt('123456789')).toBe(BigInt('123456789'));
      expect(ensureRequiredBigInt(123456)).toBe(BigInt('123456'));
      expect(ensureRequiredBigInt(BigInt('999999'))).toBe(BigInt('999999'));
    });

    it('should throw error for null input', () => {
      expect(() => ensureRequiredBigInt(null)).toThrow('Value cannot be null when BigInt is required');
    });

    it('should throw error for undefined input', () => {
      expect(() => ensureRequiredBigInt(undefined)).toThrow('Value cannot be null when BigInt is required');
    });

    it('should throw error for invalid string', () => {
      expect(() => ensureRequiredBigInt('invalid')).toThrow('Value cannot be null when BigInt is required');
    });
  });

  describe('formatBigInt', () => {
    it('should format BigInt as string', () => {
      expect(formatBigInt(BigInt('123456789'))).toBe('123456789');
    });

    it('should format large BigInt', () => {
      expect(formatBigInt(BigInt('999999999999999999'))).toBe('999999999999999999');
    });

    it('should format zero', () => {
      expect(formatBigInt(BigInt('0'))).toBe('0');
    });

    it('should format negative BigInt', () => {
      expect(formatBigInt(BigInt('-123456'))).toBe('-123456');
    });
  });

  describe('parseStringId', () => {
    it('should parse valid string ID to BigInt', () => {
      expect(parseStringId('123456789')).toBe(BigInt('123456789'));
    });

    it('should return null for invalid string', () => {
      expect(parseStringId('invalid')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(parseStringId(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseStringId(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseStringId('')).toBeNull();
    });

    it('should handle zero', () => {
      expect(parseStringId('0')).toBe(BigInt('0'));
    });

    it('should handle negative numbers', () => {
      expect(parseStringId('-123')).toBe(BigInt('-123'));
    });
  });

  describe('safeParseInt', () => {
    it('should parse valid string to number', () => {
      expect(safeParseInt('123')).toBe(123);
    });

    it('should parse valid number', () => {
      expect(safeParseInt(456)).toBe(456);
    });

    it('should use default value for invalid string', () => {
      expect(safeParseInt('invalid', 999)).toBe(999);
    });

    it('should use default value for null', () => {
      expect(safeParseInt(null, 777)).toBe(777);
    });

    it('should use default value for undefined', () => {
      expect(safeParseInt(undefined, 555)).toBe(555);
    });

    it('should use 0 as default when no default provided', () => {
      expect(safeParseInt('invalid')).toBe(0);
    });

    it('should handle zero correctly', () => {
      expect(safeParseInt('0')).toBe(0);
      expect(safeParseInt(0)).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(safeParseInt('-123')).toBe(-123);
      expect(safeParseInt(-456)).toBe(-456);
    });

    it('should handle floating point strings by truncating', () => {
      expect(safeParseInt('123.456')).toBe(123);
      expect(safeParseInt('999.999')).toBe(999);
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage with default 2 decimal places', () => {
      expect(formatPercentage(0.1234)).toBe('12.34%');
    });

    it('should format percentage with custom decimal places', () => {
      expect(formatPercentage(0.1234, 1)).toBe('12.3%');
      expect(formatPercentage(0.1234, 3)).toBe('12.340%');
    });

    it('should handle zero', () => {
      expect(formatPercentage(0)).toBe('0.00%');
    });

    it('should handle 100%', () => {
      expect(formatPercentage(1)).toBe('100.00%');
    });

    it('should handle values over 100%', () => {
      expect(formatPercentage(1.5)).toBe('150.00%');
    });

    it('should handle negative percentages', () => {
      expect(formatPercentage(-0.1)).toBe('-10.00%');
    });

    it('should handle very small numbers', () => {
      expect(formatPercentage(0.0001)).toBe('0.01%');
    });

    it('should handle rounding correctly', () => {
      expect(formatPercentage(0.12345)).toBe('12.35%'); // Should round up
      expect(formatPercentage(0.12344)).toBe('12.34%'); // Should round down
    });

    it('should handle 0 decimal places', () => {
      expect(formatPercentage(0.1234, 0)).toBe('12%');
    });
  });
});