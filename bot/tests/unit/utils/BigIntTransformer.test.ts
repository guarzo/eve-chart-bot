import { BigIntTransformer } from '../../../src/utils/BigIntTransformer';

describe('BigIntTransformer', () => {
  describe('toBigInt', () => {
    it('should handle bigint values', () => {
      const input = BigInt(123);
      expect(BigIntTransformer.toBigInt(input)).toBe(BigInt(123));
    });

    it('should handle string values', () => {
      expect(BigIntTransformer.toBigInt('456')).toBe(BigInt(456));
      expect(BigIntTransformer.toBigInt('  789  ')).toBe(BigInt(789)); // Trimmed
    });

    it('should handle number values', () => {
      expect(BigIntTransformer.toBigInt(123)).toBe(BigInt(123));
      expect(BigIntTransformer.toBigInt(123.7)).toBe(BigInt(123)); // Floored
    });

    it('should handle null/undefined values', () => {
      expect(BigIntTransformer.toBigInt(null)).toBeNull();
      expect(BigIntTransformer.toBigInt(undefined)).toBeNull();
      expect(BigIntTransformer.toBigInt('')).toBeNull();
      expect(BigIntTransformer.toBigInt('   ')).toBeNull();
    });

    it('should handle decimal strings by truncating', () => {
      expect(BigIntTransformer.toBigInt('123.456')).toBe(BigInt(123));
      expect(BigIntTransformer.toBigInt('999.999')).toBe(BigInt(999));
    });

    it('should throw for invalid values', () => {
      expect(() => BigIntTransformer.toBigInt('not-a-number')).toThrow('Invalid BigInt string');
      expect(() => BigIntTransformer.toBigInt({})).toThrow('Cannot convert object to BigInt');
      expect(() => BigIntTransformer.toBigInt(NaN)).toThrow('Invalid BigInt number');
      expect(() => BigIntTransformer.toBigInt(Infinity)).toThrow('Invalid BigInt number');
    });
  });

  describe('toRequiredBigInt', () => {
    it('should return BigInt for valid values', () => {
      expect(BigIntTransformer.toRequiredBigInt('123')).toBe(BigInt(123));
      expect(BigIntTransformer.toRequiredBigInt(456)).toBe(BigInt(456));
    });

    it('should throw for null/undefined values', () => {
      expect(() => BigIntTransformer.toRequiredBigInt(null)).toThrow('Required BigInt value is null');
      expect(() => BigIntTransformer.toRequiredBigInt(undefined)).toThrow('Required BigInt value is null');
      expect(() => BigIntTransformer.toRequiredBigInt('')).toThrow('Required BigInt value is null');
    });
  });

  describe('toString', () => {
    it('should convert BigInt to string', () => {
      expect(BigIntTransformer.toString(BigInt(123))).toBe('123');
      expect(BigIntTransformer.toString(BigInt(0))).toBe('0');
    });

    it('should handle null/undefined', () => {
      expect(BigIntTransformer.toString(null)).toBeNull();
      expect(BigIntTransformer.toString(undefined)).toBeNull();
    });
  });

  describe('toRequiredString', () => {
    it('should convert BigInt to string', () => {
      expect(BigIntTransformer.toRequiredString(BigInt(123))).toBe('123');
    });

    it('should throw for null/undefined', () => {
      expect(() => BigIntTransformer.toRequiredString(null)).toThrow('Required BigInt string is null');
      expect(() => BigIntTransformer.toRequiredString(undefined)).toThrow('Required BigInt string is null');
    });
  });

  describe('arrayToStringArray', () => {
    it('should convert array of BigInts to strings', () => {
      const input = [BigInt(1), BigInt(2), null, BigInt(3), undefined];
      const result = BigIntTransformer.arrayToStringArray(input);
      expect(result).toEqual(['1', '2', '3']);
    });

    it('should handle empty array', () => {
      expect(BigIntTransformer.arrayToStringArray([])).toEqual([]);
    });
  });

  describe('arrayToBigIntArray', () => {
    it('should convert mixed array to BigInts', () => {
      const input = ['1', 2, BigInt(3), null, '4'];
      const result = BigIntTransformer.arrayToBigIntArray(input);
      expect(result).toEqual([BigInt(1), BigInt(2), BigInt(3), BigInt(4)]);
    });

    it('should filter out invalid values', () => {
      const input = ['1', 'invalid', 2, null];
      // Should only include valid conversions
      const result = BigIntTransformer.arrayToBigIntArray(input);
      expect(result).toEqual([BigInt(1), BigInt(2)]);
    });
  });

  describe('EVE ID specific methods', () => {
    describe('toEveId', () => {
      it('should convert positive values', () => {
        expect(BigIntTransformer.toEveId('123456')).toBe(BigInt(123456));
        expect(BigIntTransformer.toEveId(789012)).toBe(BigInt(789012));
      });

      it('should throw for invalid EVE IDs', () => {
        expect(() => BigIntTransformer.toEveId(0)).toThrow('Invalid EVE ID: must be positive');
        expect(() => BigIntTransformer.toEveId(-123)).toThrow('Invalid EVE ID: must be positive');
      });
    });

    describe('toEveIdArray', () => {
      it('should convert array to EVE IDs', () => {
        const input = ['123', 456, '789'];
        const result = BigIntTransformer.toEveIdArray(input);
        expect(result).toEqual([BigInt(123), BigInt(456), BigInt(789)]);
      });
    });
  });

  describe('toIskValue', () => {
    it('should convert non-negative values', () => {
      expect(BigIntTransformer.toIskValue('1000000')).toBe(BigInt(1000000));
      expect(BigIntTransformer.toIskValue(0)).toBe(BigInt(0));
    });

    it('should throw for negative values', () => {
      expect(() => BigIntTransformer.toIskValue(-100)).toThrow('Invalid ISK value: must be non-negative');
    });
  });

  describe('toKillmailId', () => {
    it('should convert valid 32-bit values', () => {
      expect(BigIntTransformer.toKillmailId(123456)).toBe(BigInt(123456));
      expect(BigIntTransformer.toKillmailId(-123456)).toBe(BigInt(-123456));
    });

    it('should throw for out-of-range values', () => {
      expect(() => BigIntTransformer.toKillmailId(2147483648)).toThrow('Invalid killmail ID: out of 32-bit range');
      expect(() => BigIntTransformer.toKillmailId(-2147483649)).toThrow('Invalid killmail ID: out of 32-bit range');
    });
  });

  describe('database utilities', () => {
    it('should prepare values for database', () => {
      expect(BigIntTransformer.forDatabase('123')).toBe(BigInt(123));
      expect(BigIntTransformer.forDatabase(null)).toBeNull();
    });

    it('should prepare arrays for database', () => {
      const input = ['1', 2, null, '3'];
      const result = BigIntTransformer.arrayForDatabase(input);
      expect(result).toEqual([BigInt(1), BigInt(2), BigInt(3)]);
    });
  });

  describe('JSON utilities', () => {
    it('should prepare values for JSON', () => {
      expect(BigIntTransformer.forJson(BigInt(123))).toBe('123');
      expect(BigIntTransformer.forJson(null)).toBeNull();
    });

    it('should prepare values for logging', () => {
      expect(BigIntTransformer.forLogging(BigInt(123))).toBe('123');
      expect(BigIntTransformer.forLogging(null)).toBe('null');
      expect(BigIntTransformer.forLogging(undefined)).toBe('null');
    });
  });

  describe('formatting utilities', () => {
    describe('formatIsk', () => {
      it('should format ISK values correctly', () => {
        expect(BigIntTransformer.formatIsk(BigInt(500))).toBe('500 ISK');
        expect(BigIntTransformer.formatIsk(BigInt(1000))).toBe('1.00K ISK');
        expect(BigIntTransformer.formatIsk(BigInt(1000000))).toBe('1.00M ISK');
        expect(BigIntTransformer.formatIsk(BigInt(1500000))).toBe('1.50M ISK');
        expect(BigIntTransformer.formatIsk(BigInt(1000000000))).toBe('1.00B ISK');
        expect(BigIntTransformer.formatIsk(BigInt(1000000000000))).toBe('1.00T ISK');
        expect(BigIntTransformer.formatIsk(null)).toBe('0 ISK');
      });
    });

    describe('formatNumber', () => {
      it('should format numbers with locale', () => {
        expect(BigIntTransformer.formatNumber(BigInt(1234567))).toBe('1,234,567');
        expect(BigIntTransformer.formatNumber(null)).toBe('0');
      });
    });
  });

  describe('validation utilities', () => {
    describe('isValidEveId', () => {
      it('should validate EVE IDs', () => {
        expect(BigIntTransformer.isValidEveId(BigInt(123456))).toBe(true);
        expect(BigIntTransformer.isValidEveId(BigInt(0))).toBe(false);
        expect(BigIntTransformer.isValidEveId(BigInt(-123))).toBe(false);
      });
    });

    describe('areValidEveIds', () => {
      it('should validate array of EVE IDs', () => {
        const validIds = [BigInt(123), BigInt(456), BigInt(789)];
        const invalidIds = [BigInt(123), BigInt(0), BigInt(456)];
        
        expect(BigIntTransformer.areValidEveIds(validIds)).toBe(true);
        expect(BigIntTransformer.areValidEveIds(invalidIds)).toBe(false);
      });
    });
  });

  describe('migration helpers', () => {
    describe('migrateFromLegacyPattern', () => {
      it('should handle valid conversions', () => {
        expect(BigIntTransformer.migrateFromLegacyPattern('123')).toBe(BigInt(123));
        expect(BigIntTransformer.migrateFromLegacyPattern(456)).toBe(BigInt(456));
      });

      it('should handle invalid conversions gracefully', () => {
        // Should not throw, but warn and return null
        expect(BigIntTransformer.migrateFromLegacyPattern('invalid')).toBeNull();
      });
    });

    describe('migrateCharacterIds', () => {
      it('should migrate character objects', () => {
        const characters = [
          { eveId: '123456' },
          { eveId: 789012 },
          { eveId: 'invalid' }, // Should be filtered out
          { eveId: '345678' },
        ];
        
        const result = BigIntTransformer.migrateCharacterIds(characters);
        expect(result).toEqual([BigInt(123456), BigInt(789012), BigInt(345678)]);
      });
    });
  });

  describe('class-transformer decorators', () => {
    it('should provide decorator functions', () => {
      expect(typeof BigIntTransformer.stringTransform).toBe('function');
      expect(typeof BigIntTransformer.requiredStringTransform).toBe('function');
      expect(typeof BigIntTransformer.stringArrayTransform).toBe('function');
    });
  });

  describe('zod schemas', () => {
    it('should provide zod schemas', () => {
      expect(BigIntTransformer.zodSchema).toBeDefined();
      expect(BigIntTransformer.zodRequiredSchema).toBeDefined();
      expect(BigIntTransformer.zodEveIdSchema).toBeDefined();
    });

    it('should validate with zod schemas', () => {
      // Test required schema
      expect(BigIntTransformer.zodRequiredSchema.parse('123')).toBe(BigInt(123));
      expect(BigIntTransformer.zodRequiredSchema.parse(456)).toBe(BigInt(456));
      
      // Test EVE ID schema
      expect(BigIntTransformer.zodEveIdSchema.parse('123456')).toBe(BigInt(123456));
      expect(() => BigIntTransformer.zodEveIdSchema.parse('0')).toThrow();
    });
  });
});