import { CharacterGroup } from '../../../src/domain/character/CharacterGroup';
import { Character } from '../../../src/domain/character/Character';
import { plainToClass, instanceToPlain } from 'class-transformer';

describe('CharacterGroup', () => {
  describe('constructor', () => {
    it('should create a character group instance', () => {
      const group = new CharacterGroup({
        id: 'group-123',
        map_name: 'Test Map',
        mainCharacterId: '12345',
        characters: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(group).toBeInstanceOf(CharacterGroup);
      expect(group.id).toBe('group-123');
      expect(group.map_name).toBe('Test Map');
      expect(group.mainCharacterId).toBe('12345');
      expect(group.characters).toEqual([]);
    });

    it('should assign partial data', () => {
      const group = new CharacterGroup({
        id: 'group-123',
        map_name: 'Test Map',
      });

      expect(group.id).toBe('group-123');
      expect(group.map_name).toBe('Test Map');
      expect(group.mainCharacterId).toBeUndefined();
    });
  });

  describe('name getter', () => {
    it('should return map_name as name', () => {
      const group = new CharacterGroup({
        id: 'group-123',
        map_name: 'My Test Map',
        mainCharacterId: '12345',
      });

      expect(group.name).toBe('My Test Map');
    });
  });

  describe('class-transformer integration', () => {
    it('should properly transform from plain object', () => {
      const plainObj = {
        id: 'group-123',
        map_name: 'Test Map',
        mainCharacterId: '12345',
        characters: [
          {
            eveId: '12345',
            name: 'Main Character',
            corporationId: 98000001,
            corporationTicker: 'TSTC',
            mainCharacterId: '12345',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
          {
            eveId: '67890',
            name: 'Alt Character',
            corporationId: 98000001,
            corporationTicker: 'TSTC',
            mainCharacterId: '12345',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
        ],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-06-01T00:00:00Z',
      };

      const group = plainToClass(CharacterGroup, plainObj);

      expect(group).toBeInstanceOf(CharacterGroup);
      expect(group.id).toBe('group-123');
      expect(group.map_name).toBe('Test Map');
      expect(group.mainCharacterId).toBe('12345');
      expect(group.characters).toHaveLength(2);
    });

    it('should exclude properties not marked with @Expose', () => {
      const plainObj = {
        id: 'group-123',
        map_name: 'Test Map',
        mainCharacterId: '12345',
        characters: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        someExtraField: 'should not appear',
      };

      const group = plainToClass(CharacterGroup, plainObj, { excludeExtraneousValues: true });
      const plain = instanceToPlain(group);

      expect(plain).not.toHaveProperty('someExtraField');
    });

    it('should transform dates properly', () => {
      const now = new Date();
      const plainObj = {
        id: 'group-123',
        map_name: 'Test Map',
        characters: [],
        createdAt: now,
        updatedAt: now,
      };

      const group = plainToClass(CharacterGroup, plainObj);
      const plain = instanceToPlain(group);

      expect(plain.createdAt).toBe(now.toISOString());
      expect(plain.updatedAt).toBe(now.toISOString());
    });

    it('should handle null dates', () => {
      const plainObj = {
        id: 'group-123',
        map_name: 'Test Map',
        characters: [],
        createdAt: null,
        updatedAt: null,
      };

      const group = plainToClass(CharacterGroup, plainObj);
      const plain = instanceToPlain(group);

      expect(plain.createdAt).toBeNull();
      expect(plain.updatedAt).toBeNull();
    });

    it('should transform mainCharacterId to string', () => {
      const plainObj = {
        id: 'group-123',
        map_name: 'Test Map',
        mainCharacterId: 12345, // number input
        characters: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const group = plainToClass(CharacterGroup, plainObj);
      const plain = instanceToPlain(group);

      expect(plain.mainCharacterId).toBe('12345'); // should be string in output
    });
  });

  describe('character relationships', () => {
    let group: CharacterGroup;
    let mainCharacter: any;
    let altCharacter: any;

    beforeEach(() => {
      mainCharacter = {
        eveId: '100',
        name: 'Main Character',
        corporationId: 98000001,
        corporationTicker: 'TSTC',
        mainCharacterId: '100',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      altCharacter = {
        eveId: '200',
        name: 'Alt Character',
        corporationId: 98000001,
        corporationTicker: 'TSTC',
        mainCharacterId: '100',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const plainObj = {
        id: 'group-123',
        map_name: 'Test Map',
        mainCharacterId: '100',
        characters: [mainCharacter, altCharacter],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      group = plainToClass(CharacterGroup, plainObj);
    });

    it('should have correct number of characters', () => {
      expect(group.characters).toHaveLength(2);
    });

    it('should identify main character correctly', () => {
      const plain = instanceToPlain(group);
      expect(plain.mainCharacterId).toBe('100');
    });

    it('should handle groups without main character', () => {
      const groupWithoutMain = new CharacterGroup({
        id: 'group-456',
        map_name: 'Another Map',
        characters: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(groupWithoutMain.mainCharacterId).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty character array', () => {
      const group = new CharacterGroup({
        id: 'group-123',
        map_name: 'Empty Group',
        characters: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(group.characters).toEqual([]);
    });

    it('should handle undefined mainCharacterId', () => {
      const group = new CharacterGroup({
        id: 'group-123',
        map_name: 'Test Map',
        // mainCharacterId not provided
        characters: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(group.mainCharacterId).toBeUndefined();
    });

    it('should maintain character order', () => {
      const chars = [
        { eveId: '1', name: 'First' },
        { eveId: '2', name: 'Second' },
        { eveId: '3', name: 'Third' },
      ];

      const group = new CharacterGroup({
        id: 'group-123',
        map_name: 'Test Map',
        characters: chars as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(group.characters[0].eveId).toBe('1');
      expect(group.characters[1].eveId).toBe('2');
      expect(group.characters[2].eveId).toBe('3');
    });
  });
});