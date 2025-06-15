import 'reflect-metadata';
import { BigIntTransformer } from '../../../../src/shared/utilities/BigIntTransformer';

describe('BigIntTransformer', () => {
  describe('toBigInt', () => {
    it('should convert string to bigint', () => {
      // Act
      const result = BigIntTransformer.toBigInt('123456789');

      // Assert
      expect(result).toBe(BigInt(123456789));
    });

    it('should convert number to bigint', () => {
      // Act
      const result = BigIntTransformer.toBigInt(123456);

      // Assert
      expect(result).toBe(BigInt(123456));
    });

    it('should return existing bigint unchanged', () => {
      // Arrange
      const value = BigInt(987654321);

      // Act
      const result = BigIntTransformer.toBigInt(value);

      // Assert
      expect(result).toBe(value);
    });

    it('should return null for null input', () => {
      // Act
      const result = BigIntTransformer.toBigInt(null);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      // Act
      const result = BigIntTransformer.toBigInt(undefined);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      // Act
      const result = BigIntTransformer.toBigInt('');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for whitespace-only string', () => {
      // Act
      const result = BigIntTransformer.toBigInt('   ');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle decimal string by truncating', () => {
      // Act
      const result = BigIntTransformer.toBigInt('123.456');

      // Assert
      expect(result).toBe(BigInt(123));
    });

    it('should handle negative numbers', () => {
      // Act
      const result = BigIntTransformer.toBigInt(-456);

      // Assert
      expect(result).toBe(BigInt(-456));
    });

    it('should handle negative strings', () => {
      // Act
      const result = BigIntTransformer.toBigInt('-789');

      // Assert
      expect(result).toBe(BigInt(-789));
    });

    it('should handle very large numbers', () => {
      // Act
      const result = BigIntTransformer.toBigInt('9007199254740991999');

      // Assert
      expect(result).toBe(BigInt('9007199254740991999'));
    });

    it('should floor decimal numbers', () => {
      // Act
      const result = BigIntTransformer.toBigInt(123.99);

      // Assert
      expect(result).toBe(BigInt(123));
    });

    it('should throw for invalid string format', () => {
      // Act & Assert
      expect(() => BigIntTransformer.toBigInt('invalid')).toThrow('Invalid BigInt string');
    });

    it('should throw for NaN', () => {
      // Act & Assert
      expect(() => BigIntTransformer.toBigInt(NaN)).toThrow('Invalid BigInt number');
    });

    it('should throw for Infinity', () => {
      // Act & Assert
      expect(() => BigIntTransformer.toBigInt(Infinity)).toThrow('Invalid BigInt number');
    });

    it('should throw for unsupported types', () => {
      // Act & Assert
      expect(() => BigIntTransformer.toBigInt({})).toThrow('Cannot convert object to BigInt');
      expect(() => BigIntTransformer.toBigInt([])).toThrow('Cannot convert object to BigInt');
      expect(() => BigIntTransformer.toBigInt(true)).toThrow('Cannot convert boolean to BigInt');
    });
  });

  describe('toRequiredBigInt', () => {
    it('should convert valid values to bigint', () => {
      // Act
      const result = BigIntTransformer.toRequiredBigInt('123');

      // Assert
      expect(result).toBe(BigInt(123));
    });

    it('should throw for null input', () => {
      // Act & Assert
      expect(() => BigIntTransformer.toRequiredBigInt(null)).toThrow('Required BigInt value is null');
    });

    it('should throw for undefined input', () => {
      // Act & Assert
      expect(() => BigIntTransformer.toRequiredBigInt(undefined)).toThrow('Required BigInt value is null');
    });

    it('should throw for empty string', () => {
      // Act & Assert
      expect(() => BigIntTransformer.toRequiredBigInt('')).toThrow('Required BigInt value is null');
    });
  });

  describe('toString', () => {
    it('should convert bigint to string', () => {
      // Act
      const result = BigIntTransformer.toString(BigInt(123456789));

      // Assert
      expect(result).toBe('123456789');
    });

    it('should handle null input', () => {
      // Act
      const result = BigIntTransformer.toString(null);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle undefined input', () => {
      // Act
      const result = BigIntTransformer.toString(undefined);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle very large bigints', () => {
      // Arrange
      const value = BigInt('9007199254740991999');

      // Act
      const result = BigIntTransformer.toString(value);

      // Assert
      expect(result).toBe('9007199254740991999');
    });

    it('should handle negative bigints', () => {
      // Act
      const result = BigIntTransformer.toString(BigInt(-123));

      // Assert
      expect(result).toBe('-123');
    });
  });

  describe('integration tests', () => {
    it('should handle round-trip conversion', () => {
      // Arrange
      const originalString = '9007199254740991999';

      // Act
      const bigintValue = BigIntTransformer.toBigInt(originalString);
      const backToString = BigIntTransformer.toString(bigintValue);

      // Assert
      expect(backToString).toBe(originalString);
    });

    it('should handle negative round-trip conversion', () => {
      // Arrange
      const originalString = '-123456789';

      // Act
      const bigintValue = BigIntTransformer.toBigInt(originalString);
      const backToString = BigIntTransformer.toString(bigintValue);

      // Assert
      expect(backToString).toBe(originalString);
    });

    it('should handle number to string conversion', () => {
      // Arrange
      const originalNumber = 123456;

      // Act
      const bigintValue = BigIntTransformer.toBigInt(originalNumber);
      const stringValue = BigIntTransformer.toString(bigintValue);

      // Assert
      expect(stringValue).toBe('123456');
    });
  });
});