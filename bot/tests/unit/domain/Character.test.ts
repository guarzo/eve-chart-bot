import { Character } from '../../../src/domain/character/Character';
import { plainToClass, instanceToPlain } from 'class-transformer';

describe('Character', () => {
  describe('class-transformer integration', () => {
    it('should properly transform from plain object', () => {
      const plainObj = {
        eveId: '12345',
        name: 'Test Character',
        allianceId: 99000001,
        allianceTicker: 'TEST',
        corporationId: 98000001,
        corporationTicker: 'TSTC',
        characterGroupId: 'group-123',
        mainCharacterId: '12345',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-06-01T00:00:00Z',
        deletedAt: null,
      };

      const character = plainToClass(Character, plainObj);

      expect(character).toBeInstanceOf(Character);
      expect(character.eveId).toBe('12345');
      expect(character.name).toBe('Test Character');
      expect(character.allianceId).toBe(99000001);
      expect(character.allianceTicker).toBe('TEST');
      expect(character.corporationId).toBe(98000001);
      expect(character.corporationTicker).toBe('TSTC');
      expect(character.characterGroupId).toBe('group-123');
      expect(character.mainCharacterId).toBe('12345');
    });

    it('should exclude properties not marked with @Expose', () => {
      const plainObj = {
        eveId: '12345',
        name: 'Test Character',
        corporationId: 98000001,
        corporationTicker: 'TSTC',
        createdAt: new Date(),
        updatedAt: new Date(),
        someExtraField: 'should not appear',
        anotherField: 123,
      };

      const character = plainToClass(Character, plainObj, { excludeExtraneousValues: true });
      const plain = instanceToPlain(character);

      expect(plain).not.toHaveProperty('someExtraField');
      expect(plain).not.toHaveProperty('anotherField');
    });

    it('should transform dates properly', () => {
      const now = new Date();
      const plainObj = {
        eveId: '12345',
        name: 'Test Character',
        corporationId: 98000001,
        corporationTicker: 'TSTC',
        createdAt: now,
        updatedAt: now,
      };

      const character = plainToClass(Character, plainObj);
      const plain = instanceToPlain(character);

      expect(plain.createdAt).toBe(now.toISOString());
      expect(plain.updatedAt).toBe(now.toISOString());
    });

    it('should handle null dates', () => {
      const plainObj = {
        eveId: '12345',
        name: 'Test Character',
        corporationId: 98000001,
        corporationTicker: 'TSTC',
        createdAt: null,
        updatedAt: null,
        deletedAt: null,
      };

      const character = plainToClass(Character, plainObj);
      const plain = instanceToPlain(character);

      // When dates are null in input, they get transformed to null strings
      expect(plain.createdAt).toBeNull();
      expect(plain.updatedAt).toBeNull();
      // deletedAt might not be exposed, check if it exists
      if ('deletedAt' in plain) {
        expect(plain.deletedAt).toBeNull();
      }
    });

    it('should transform eveId to string', () => {
      const plainObj = {
        eveId: 12345, // number input
        name: 'Test Character',
        corporationId: 98000001,
        corporationTicker: 'TSTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const character = plainToClass(Character, plainObj);
      const plain = instanceToPlain(character);

      expect(plain.eveId).toBe('12345'); // should be string in output
    });

    it('should handle optional fields', () => {
      const plainObj = {
        eveId: '12345',
        name: 'Test Character',
        corporationId: 98000001,
        corporationTicker: 'TSTC',
        createdAt: new Date(),
        updatedAt: new Date(),
        // No alliance fields, no characterGroupId, no mainCharacterId
      };

      const character = plainToClass(Character, plainObj);

      expect(character.allianceId).toBeUndefined();
      expect(character.allianceTicker).toBeUndefined();
      expect(character.characterGroupId).toBeUndefined();
      expect(character.mainCharacterId).toBeUndefined();
    });

    it('should correctly identify main characters', () => {
      const plainObj = {
        eveId: '12345',
        name: 'Main Character',
        corporationId: 98000001,
        corporationTicker: 'TSTC',
        mainCharacterId: '12345', // Same as eveId
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const character = plainToClass(Character, plainObj);
      
      // isMain is a getter, not exposed in plain object
      expect(character.isMain).toBe(true);
    });

    it('should correctly identify alt characters', () => {
      const plainObj = {
        eveId: '12345',
        name: 'Alt Character',
        corporationId: 98000001,
        corporationTicker: 'TSTC',
        mainCharacterId: '99999', // Different from eveId
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const character = plainToClass(Character, plainObj);
      
      // isMain is a getter, not exposed in plain object
      expect(character.isMain).toBe(false);
    });

    it('should handle characters without mainCharacterId', () => {
      const plainObj = {
        eveId: '12345',
        name: 'Solo Character',
        corporationId: 98000001,
        corporationTicker: 'TSTC',
        createdAt: new Date(),
        updatedAt: new Date(),
        // No mainCharacterId
      };

      const character = plainToClass(Character, plainObj);
      
      // isMain is a getter, not exposed in plain object
      expect(character.isMain).toBe(false);
    });
  });

  describe('computed properties', () => {
    it('should compute isMain correctly', () => {
      const mainCharacter = plainToClass(Character, {
        eveId: '100',
        name: 'Main',
        corporationId: 1,
        corporationTicker: 'CORP',
        mainCharacterId: '100',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const altCharacter = plainToClass(Character, {
        eveId: '200',
        name: 'Alt',
        corporationId: 1,
        corporationTicker: 'CORP',
        mainCharacterId: '100',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // isMain is a getter on the instance, not exposed in serialization
      expect(mainCharacter.isMain).toBe(true);
      expect(altCharacter.isMain).toBe(false);
    });
  });
});