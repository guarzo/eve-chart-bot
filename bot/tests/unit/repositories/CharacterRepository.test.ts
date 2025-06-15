import 'reflect-metadata';
import { CharacterRepository } from '../../../src/infrastructure/repositories/CharacterRepository';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../src/lib/logger';
import { Character } from '../../../src/domain/character/Character';
import { CharacterGroup } from '../../../src/domain/character/CharacterGroup';
import { DatabaseError } from '../../../src/shared/errors';

// Mock dependencies
jest.mock('../../../src/lib/logger');
jest.mock('../../../src/infrastructure/monitoring/MetricsCollector', () => ({
  MetricsCollector: jest.fn().mockImplementation(() => ({
    incrementCounter: jest.fn(),
  })),
  metricsCollector: {
    incrementCounter: jest.fn(),
  }
}));
jest.mock('../../../src/infrastructure/monitoring/TracingService', () => ({
  TracingService: {
    getInstance: jest.fn(() => ({
      getCurrentSpan: jest.fn(),
      addTags: jest.fn(),
      logToSpan: jest.fn(),
    }))
  },
  tracingService: {
    getCurrentSpan: jest.fn(),
    addTags: jest.fn(),
    logToSpan: jest.fn(),
  }
}));
jest.mock('../../../src/shared/errors/ErrorHandler', () => {
  const mockErrorHandler = {
    createCorrelationId: jest.fn(() => 'test-correlation-id'),
    withRetry: jest.fn(async (fn) => await fn()),
    handleError: jest.fn((error) => { throw error; }),
    handleDatabaseError: jest.fn((error) => { throw error; }),
  };
  
  return {
    ErrorHandler: {
      getInstance: jest.fn(() => mockErrorHandler)
    },
    errorHandler: mockErrorHandler
  };
});

// Mock PrismaMapper
jest.mock('../../../src/infrastructure/mapper/PrismaMapper', () => ({
  PrismaMapper: {
    map: jest.fn((data, targetClass) => {
      if (targetClass === Character) {
        return new Character({
          eveId: data.eveId?.toString() || data.eveId,
          name: data.name,
          corporationId: data.corporationId,
          corporationTicker: data.corporationTicker,
          allianceId: data.allianceId,
          allianceTicker: data.allianceTicker,
          characterGroupId: data.characterGroupId,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      }
      if (targetClass === CharacterGroup) {
        return new CharacterGroup({
          id: data.id,
          mapName: data.mapName,
          mainCharacterId: data.mainCharacterId,
          characters: data.characters || [],
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      }
      return data;
    }),
    mapArray: jest.fn((dataArray, targetClass) => {
      return dataArray.map((data: any) => {
        if (targetClass === Character) {
          return new Character({
            eveId: data.eveId?.toString() || data.eveId,
            name: data.name,
            corporationId: data.corporationId,
            corporationTicker: data.corporationTicker,
            allianceId: data.allianceId,
            allianceTicker: data.allianceTicker,
            characterGroupId: data.characterGroupId,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        }
        if (targetClass === CharacterGroup) {
          return new CharacterGroup({
            id: data.id,
            mapName: data.mapName,
            mainCharacterId: data.mainCharacterId,
            characters: data.characters || [],
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        }
        return data;
      });
    }),
  },
}));

// Mock Prisma Client
const mockPrismaClient = {
  character: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  characterGroup: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(async (callback) => await callback(mockPrismaClient)),
} as unknown as PrismaClient;

describe('CharacterRepository', () => {
  let repository: CharacterRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new CharacterRepository(mockPrismaClient);
  });

  describe('getCharacter', () => {
    it('should get a character by ID', async () => {
      // Arrange
      const characterId = BigInt('1001');
      const mockCharacterData = {
        eveId: characterId,
        name: 'Test Character',
        corporationId: 98765432,
        corporationTicker: 'TEST',
        allianceId: 99999999,
        allianceTicker: 'TALL',
        characterGroupId: 'group-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaClient.character.findUnique.mockResolvedValue(mockCharacterData);

      // Act
      const result = await repository.getCharacter(characterId);

      // Assert
      expect(result).toBeInstanceOf(Character);
      expect(result?.eveId).toBe(characterId.toString());
      expect(result?.name).toBe('Test Character');
      expect(mockPrismaClient.character.findUnique).toHaveBeenCalledWith({
        where: { eveId: characterId },
      });
    });

    it('should return null when character not found', async () => {
      // Arrange
      mockPrismaClient.character.findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.getCharacter(BigInt('9999'));

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockPrismaClient.character.findUnique.mockRejectedValue(error);

      // Act & Assert
      await expect(repository.getCharacter(BigInt('1001'))).rejects.toThrow('Database connection failed');
    });
  });

  describe('getAllCharacters', () => {
    it('should get all characters', async () => {
      // Arrange
      const mockCharacters = [
        {
          eveId: BigInt('1001'),
          name: 'Character 1',
          corporationId: 98765432,
          corporationTicker: 'TEST1',
          allianceId: null,
          allianceTicker: null,
          characterGroupId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          eveId: BigInt('1002'),
          name: 'Character 2',
          corporationId: 98765433,
          corporationTicker: 'TEST2',
          allianceId: null,
          allianceTicker: null,
          characterGroupId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      mockPrismaClient.character.findMany.mockResolvedValue(mockCharacters);

      // Act
      const result = await repository.getAllCharacters();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Character);
      expect(result[0].name).toBe('Character 1');
      expect(mockPrismaClient.character.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });

    it('should return empty array when no characters exist', async () => {
      // Arrange
      mockPrismaClient.character.findMany.mockResolvedValue([]);

      // Act
      const result = await repository.getAllCharacters();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('upsertCharacter', () => {
    it('should upsert a character', async () => {
      // Arrange
      const characterData = {
        eveId: BigInt('1001'),
        name: 'Test Character',
        corporationId: 98765432,
        corporationTicker: 'TEST',
        allianceId: 99999999,
        allianceTicker: 'TALL',
        characterGroupId: 'group-1',
      };
      
      mockPrismaClient.character.upsert.mockResolvedValue({
        ...characterData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      const result = await repository.upsertCharacter(characterData);

      // Assert
      expect(result).toBeInstanceOf(Character);
      expect(result.eveId).toBe(characterData.eveId.toString());
      expect(mockPrismaClient.character.upsert).toHaveBeenCalledWith({
        where: { eveId: characterData.eveId },
        update: {
          name: characterData.name,
          corporationId: characterData.corporationId,
          corporationTicker: characterData.corporationTicker,
          allianceId: characterData.allianceId,
          allianceTicker: characterData.allianceTicker,
          characterGroupId: characterData.characterGroupId,
        },
        create: characterData,
      });
    });

    it('should handle character without alliance', async () => {
      // Arrange
      const characterData = {
        eveId: BigInt('1001'),
        name: 'Test Character',
        corporationId: 98765432,
        corporationTicker: 'TEST',
      };
      
      mockPrismaClient.character.upsert.mockResolvedValue({
        ...characterData,
        allianceId: null,
        allianceTicker: null,
        characterGroupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      const result = await repository.upsertCharacter(characterData);

      // Assert
      expect(result.allianceId).toBeNull();
    });
  });

  describe('getAllCharacterGroups', () => {
    it('should get all character groups', async () => {
      // Arrange
      const mockGroups = [
        {
          id: 'group-1',
          mapName: 'Group 1',
          mainCharacterId: BigInt('1001'),
          characters: [
            {
              eveId: BigInt('1001'),
              name: 'Main Character',
              corporationId: 98765432,
              corporationTicker: 'TEST',
            },
            {
              eveId: BigInt('1002'),
              name: 'Alt Character',
              corporationId: 98765432,
              corporationTicker: 'TEST',
            },
          ],
          mainCharacter: {
            eveId: BigInt('1001'),
            name: 'Main Character',
            corporationId: 98765432,
            corporationTicker: 'TEST',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      mockPrismaClient.characterGroup.findMany.mockResolvedValue(mockGroups);

      // Act
      const result = await repository.getAllCharacterGroups();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(CharacterGroup);
      expect(result[0].id).toBe('group-1');
      expect(result[0].characters).toHaveLength(2);
      expect(mockPrismaClient.characterGroup.findMany).toHaveBeenCalledWith({
        include: {
          characters: true,
          mainCharacter: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array when no groups exist', async () => {
      // Arrange
      mockPrismaClient.characterGroup.findMany.mockResolvedValue([]);

      // Act
      const result = await repository.getAllCharacterGroups();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getCharacterGroup', () => {
    it('should get a character group by ID', async () => {
      // Arrange
      const groupId = 'group-1';
      const mockGroup = {
        id: groupId,
        mapName: 'Group 1',
        mainCharacterId: BigInt('1001'),
        characters: [
          {
            eveId: BigInt('1001'),
            name: 'Main Character',
            corporationId: 98765432,
            corporationTicker: 'TEST',
          },
        ],
        mainCharacter: {
          eveId: BigInt('1001'),
          name: 'Main Character',
          corporationId: 98765432,
          corporationTicker: 'TEST',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaClient.characterGroup.findUnique.mockResolvedValue(mockGroup);

      // Act
      const result = await repository.getCharacterGroup(groupId);

      // Assert
      expect(result).toBeInstanceOf(CharacterGroup);
      expect(result?.id).toBe(groupId);
      expect(mockPrismaClient.characterGroup.findUnique).toHaveBeenCalledWith({
        where: { id: groupId },
        include: {
          characters: true,
          mainCharacter: true,
        },
      });
    });

    it('should return null when group not found', async () => {
      // Arrange
      mockPrismaClient.characterGroup.findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.getCharacterGroup('non-existent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getCharactersByGroup', () => {
    it('should get characters by group ID', async () => {
      // Arrange
      const groupId = 'group-1';
      const mockCharacters = [
        {
          eveId: BigInt('1001'),
          name: 'Character 1',
          corporationId: 98765432,
          corporationTicker: 'TEST',
          characterGroupId: groupId,
          allianceId: null,
          allianceTicker: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          eveId: BigInt('1002'),
          name: 'Character 2',
          corporationId: 98765432,
          corporationTicker: 'TEST',
          characterGroupId: groupId,
          allianceId: null,
          allianceTicker: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      mockPrismaClient.character.findMany.mockResolvedValue(mockCharacters);

      // Act
      const result = await repository.getCharactersByGroup(groupId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Character);
      expect(mockPrismaClient.character.findMany).toHaveBeenCalledWith({
        where: { characterGroupId: groupId },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('createCharacterGroup', () => {
    it('should create a character group', async () => {
      // Arrange
      const data = {
        mapName: 'New Group',
        mainCharacterId: BigInt('1001'),
      };
      
      const mockCreatedGroup = {
        id: 'new-group-id',
        mapName: data.mapName,
        mainCharacterId: data.mainCharacterId,
        characters: [],
        mainCharacter: {
          eveId: BigInt('1001'),
          name: 'Main Character',
          corporationId: 98765432,
          corporationTicker: 'TEST',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrismaClient.characterGroup.create.mockResolvedValue(mockCreatedGroup);

      // Act
      const result = await repository.createCharacterGroup(data);

      // Assert
      expect(result).toBeInstanceOf(CharacterGroup);
      expect(result.mapName).toBe(data.mapName);
      expect(mockPrismaClient.characterGroup.create).toHaveBeenCalledWith({
        data: {
          mapName: data.mapName,
          mainCharacterId: data.mainCharacterId,
        },
        include: {
          characters: true,
          mainCharacter: true,
        },
      });
    });

    it('should handle database errors during creation', async () => {
      // Arrange
      const data = {
        mapName: 'New Group',
        mainCharacterId: BigInt('1001'),
      };
      
      mockPrismaClient.characterGroup.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        repository.createCharacterGroup(data)
      ).rejects.toThrow('Database error');
    });
  });

  describe('deleteCharacter', () => {
    it('should delete a character', async () => {
      // Arrange
      const eveId = BigInt('1001');
      mockPrismaClient.character.delete.mockResolvedValue({});

      // Act
      await repository.deleteCharacter(eveId);

      // Assert
      expect(mockPrismaClient.character.delete).toHaveBeenCalledWith({
        where: { eveId },
      });
    });

    it('should handle database errors during deletion', async () => {
      // Arrange
      const eveId = BigInt('1001');
      mockPrismaClient.character.delete.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(repository.deleteCharacter(eveId)).rejects.toThrow('Database error');
    });
  });

  describe('updateCharacterGroup', () => {
    it('should update character group', async () => {
      // Arrange
      const groupId = 'group-1';
      const characterIds = [BigInt('1001'), BigInt('1002')];
      
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          character: {
            updateMany: jest.fn(),
          },
        };
        return await callback(mockTx);
      });
      
      mockPrismaClient.$transaction = mockTransaction;

      // Act
      await repository.updateCharacterGroup(groupId, characterIds);

      // Assert
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should handle empty character list', async () => {
      // Arrange
      const groupId = 'group-1';
      const characterIds: bigint[] = [];
      
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          character: {
            updateMany: jest.fn(),
          },
        };
        return await callback(mockTx);
      });
      
      mockPrismaClient.$transaction = mockTransaction;

      // Act
      await repository.updateCharacterGroup(groupId, characterIds);

      // Assert
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('getTrackedCharacterIds', () => {
    it('should get tracked character IDs', async () => {
      // Arrange
      const mockCharacters = [
        { eveId: BigInt('1001') },
        { eveId: BigInt('1002') },
        { eveId: BigInt('1003') },
      ];
      
      mockPrismaClient.character.findMany.mockResolvedValue(mockCharacters);

      // Act
      const result = await repository.getTrackedCharacterIds();

      // Assert
      expect(result).toEqual([BigInt('1001'), BigInt('1002'), BigInt('1003')]);
      expect(mockPrismaClient.character.findMany).toHaveBeenCalledWith({
        select: { eveId: true },
      });
    });

    it('should return empty array when no characters exist', async () => {
      // Arrange
      mockPrismaClient.character.findMany.mockResolvedValue([]);

      // Act
      const result = await repository.getTrackedCharacterIds();

      // Assert
      expect(result).toEqual([]);
    });
  });
});