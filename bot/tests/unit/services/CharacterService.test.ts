import { CharacterService } from '../../../src/services/CharacterService';
import { Character } from '../../../src/domain/character/Character';
import { CharacterGroup } from '../../../src/domain/character/CharacterGroup';
import { CharacterRepository } from '../../../src/infrastructure/repositories/CharacterRepository';
import { ESIService } from '../../../src/services/ESIService';
import { PrismaClient } from '@prisma/client';
import { ValidationError, DatabaseError, ExternalServiceError } from '../../../src/shared/errors';
import { errorHandler } from '../../../src/shared/errors/ErrorHandler';
import { logger } from '../../../src/lib/logger';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../../src/infrastructure/repositories/CharacterRepository');
jest.mock('../../../src/services/ESIService');
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
    handleServiceError: jest.fn((error) => { throw error; }),
  };
  
  return {
    ErrorHandler: {
      getInstance: jest.fn(() => mockErrorHandler)
    },
    errorHandler: mockErrorHandler
  };
});

describe('CharacterService', () => {
  let service: CharacterService;
  let mockCharacterRepository: jest.Mocked<CharacterRepository>;
  let mockESIService: jest.Mocked<ESIService>;
  let mockPrismaClient: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mocked instances
    mockPrismaClient = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockCharacterRepository = new CharacterRepository(mockPrismaClient) as jest.Mocked<CharacterRepository>;
    mockESIService = new ESIService() as jest.Mocked<ESIService>;

    // Reset all mocks including errorHandler
    (errorHandler.withRetry as jest.Mock).mockImplementation(async (fn) => await fn());
    (errorHandler.handleError as jest.Mock).mockImplementation((error) => { throw error; });
    (errorHandler.handleDatabaseError as jest.Mock).mockImplementation((error) => { throw error; });
    
    // Create service instance
    service = new CharacterService();
    // Replace the internal instances with mocks
    (service as any).characterRepository = mockCharacterRepository;
    (service as any).esiService = mockESIService;
  });

  describe('getCharacter', () => {
    it('should return a character when found', async () => {
      // Arrange
      const characterId = '12345';
      const mockCharacter = new Character({
        eveId: characterId,
        name: 'Test Character',
        corporationId: 98765
      });
      
      mockCharacterRepository.getCharacter.mockResolvedValue(mockCharacter);

      // Act
      const result = await service.getCharacter(characterId);

      // Assert
      expect(result).toEqual(mockCharacter);
      expect(mockCharacterRepository.getCharacter).toHaveBeenCalledWith(BigInt(characterId));
      expect(errorHandler.createCorrelationId).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('Getting character by ID', {
        correlationId: 'test-correlation-id',
        characterId,
      });
    });

    it('should return null when character not found', async () => {
      // Arrange
      const characterId = '12345';
      mockCharacterRepository.getCharacter.mockResolvedValue(null);

      // Act
      const result = await service.getCharacter(characterId);

      // Assert
      expect(result).toBeNull();
      expect(mockCharacterRepository.getCharacter).toHaveBeenCalledWith(BigInt(characterId));
    });

    it('should throw ValidationError for invalid characterId', async () => {
      // Act & Assert
      await expect(service.getCharacter('')).rejects.toThrow();
      await expect(service.getCharacter(null as any)).rejects.toThrow();
      await expect(service.getCharacter(undefined as any)).rejects.toThrow();
      
      expect(mockCharacterRepository.getCharacter).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      // Arrange
      const characterId = '12345';
      const dbError = new Error('Database connection failed');
      mockCharacterRepository.getCharacter.mockRejectedValue(dbError);
      (errorHandler.withRetry as jest.Mock).mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.getCharacter(characterId)).rejects.toThrow(dbError);
    });
  });

  describe('getCharacterGroup', () => {
    it('should return a character group when found', async () => {
      // Arrange
      const groupId = 'group-123';
      const mockGroup = new CharacterGroup({
        id: groupId,
        map_name: 'Test Group',
        mainCharacterId: BigInt('12345')
      });
      
      mockCharacterRepository.getCharacterGroup.mockResolvedValue(mockGroup);
      (errorHandler.withRetry as jest.Mock).mockImplementation(async (fn) => await fn());

      // Act
      const result = await service.getCharacterGroup(groupId);

      // Assert
      expect(result).toEqual(mockGroup);
      expect(mockCharacterRepository.getCharacterGroup).toHaveBeenCalledWith(groupId);
      expect(logger.debug).toHaveBeenCalledWith('Getting character group by ID', {
        correlationId: 'test-correlation-id',
        groupId,
      });
    });

    it('should throw ValidationError for invalid groupId', async () => {
      // Act & Assert
      await expect(service.getCharacterGroup('')).rejects.toThrow();
      await expect(service.getCharacterGroup(null as any)).rejects.toThrow();
      
      expect(mockCharacterRepository.getCharacterGroup).not.toHaveBeenCalled();
    });
  });

  describe('getCharactersByGroup', () => {
    it('should return all characters in a group', async () => {
      // Arrange
      const groupId = 'group-123';
      const mockCharacters = [
        new Character({ eveId: '1', name: 'Char 1', corporationId: 100 }),
        new Character({ eveId: '2', name: 'Char 2', corporationId: 200 }),
      ];
      
      mockCharacterRepository.getCharactersByGroup.mockResolvedValue(mockCharacters);
      (errorHandler.withRetry as jest.Mock).mockImplementation(async (fn) => await fn());

      // Act
      const result = await service.getCharactersByGroup(groupId);

      // Assert
      expect(result).toEqual(mockCharacters);
      expect(mockCharacterRepository.getCharactersByGroup).toHaveBeenCalledWith(groupId);
      expect(logger.debug).toHaveBeenCalledWith('Getting characters by group ID', {
        correlationId: 'test-correlation-id',
        groupId,
      });
    });

    it('should return empty array when no members found', async () => {
      // Arrange
      const groupId = 'group-123';
      mockCharacterRepository.getCharactersByGroup.mockResolvedValue([]);
      (errorHandler.withRetry as jest.Mock).mockImplementation(async (fn) => await fn());

      // Act
      const result = await service.getCharactersByGroup(groupId);

      // Assert
      expect(result).toEqual([]);
      expect(mockCharacterRepository.getCharactersByGroup).toHaveBeenCalledWith(groupId);
    });
  });

  describe('syncCharacter', () => {
    it('should update character with ESI data', async () => {
      // Arrange
      const characterId = '12345';
      const mockCharacter = new Character({
        eveId: characterId,
        name: 'Old Name',
        corporationId: 98765
      });
      const esiData = {
        name: 'New Name',
        corporation_id: 98765,
        alliance_id: 11111,
        security_status: 5.0,
      };
      const updatedCharacter = new Character({
        eveId: characterId,
        name: 'New Name',
        corporationId: 98765
      });
      
      mockCharacterRepository.upsertCharacter.mockResolvedValue(updatedCharacter);
      (errorHandler.withRetry as jest.Mock).mockImplementation(async (fn) => await fn());

      // Act
      const result = await service.syncCharacter(characterId, {
        corporationTicker: 'TEST',
        allianceTicker: 'ALLY',
        corporationId: 98765
      });

      // Assert
      expect(result).toEqual(updatedCharacter);
      expect(mockCharacterRepository.upsertCharacter).toHaveBeenCalledWith(
        expect.objectContaining({
          eveId: BigInt(characterId),
          corporationTicker: 'TEST',
          allianceTicker: 'ALLY',
          corporationId: 98765
        })
      );
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully synced character'), {
        correlationId: 'test-correlation-id',
        characterId,
        savedName: 'New Name',
      });
    });

    it('should handle missing corporation ticker', async () => {
      // Arrange
      const characterId = '12345';

      // Act & Assert
      await expect(service.syncCharacter(characterId, {
        corporationTicker: '',
        corporationId: 98765
      })).rejects.toThrow();
      expect(mockCharacterRepository.upsertCharacter).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      // Arrange
      const characterId = '12345';
      const dbError = new DatabaseError('Database error', 'read', 'character');
      
      mockCharacterRepository.upsertCharacter.mockRejectedValue(dbError);
      (errorHandler.withRetry as jest.Mock).mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.syncCharacter(characterId, {
        corporationTicker: 'TEST',
        corporationId: 98765
      })).rejects.toThrow(dbError);
    });
  });

  describe('saveCharacterGroup', () => {
    it('should save a new character group', async () => {
      // Arrange
      const groupData = {
        map_name: 'New Group',
        mainCharacterId: '12345',
      };
      const mockGroup = new CharacterGroup({
        id: 'new-group-id',
        map_name: groupData.map_name,
        mainCharacterId: BigInt(groupData.mainCharacterId)
      });
      
      mockCharacterRepository.createCharacterGroup.mockResolvedValue(mockGroup);
      (errorHandler.withRetry as jest.Mock).mockImplementation(async (fn) => await fn());

      // Act
      const result = await service.saveCharacterGroup(new CharacterGroup({
        id: '',
        map_name: groupData.map_name,
        mainCharacterId: BigInt(groupData.mainCharacterId)
      }));

      // Assert
      expect(result).toEqual(mockGroup);
      expect(mockCharacterRepository.createCharacterGroup).toHaveBeenCalledWith({
        mapName: groupData.map_name,
        mainCharacterId: BigInt(groupData.mainCharacterId)
      });
      expect(logger.debug).toHaveBeenCalledWith('Successfully saved character group', {
        correlationId: 'test-correlation-id',
        groupId: mockGroup.id,
        mapName: mockGroup.map_name,
      });
    });

    it('should validate required fields', async () => {
      // Act & Assert
      await expect(service.saveCharacterGroup(null as any)).rejects.toThrow();
      await expect(service.saveCharacterGroup(new CharacterGroup({ id: '', map_name: '', mainCharacterId: null }))).rejects.toThrow();
      
      expect(mockCharacterRepository.createCharacterGroup).not.toHaveBeenCalled();
    });
  });

  describe('getAllCharacterGroups', () => {
    it('should return all character groups', async () => {
      // Arrange
      const mockGroups = [
        new CharacterGroup({ id: 'group-1', map_name: 'Group 1', mainCharacterId: BigInt('1001') }),
        new CharacterGroup({ id: 'group-2', map_name: 'Group 2', mainCharacterId: BigInt('1002') }),
      ];
      
      mockCharacterRepository.getAllCharacterGroups.mockResolvedValue(mockGroups);
      (errorHandler.withRetry as jest.Mock).mockImplementation(async (fn) => await fn());

      // Act
      const result = await service.getAllCharacterGroups();

      // Assert
      expect(result).toEqual(mockGroups);
      expect(mockCharacterRepository.getAllCharacterGroups).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('Getting all character groups', {
        correlationId: 'test-correlation-id',
      });
    });

    it('should return empty array when no groups exist', async () => {
      // Arrange
      mockCharacterRepository.getAllCharacterGroups.mockResolvedValue([]);
      (errorHandler.withRetry as jest.Mock).mockImplementation(async (fn) => await fn());

      // Act
      const result = await service.getAllCharacterGroups();

      // Assert
      expect(result).toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith('Successfully retrieved all character groups', {
        correlationId: 'test-correlation-id',
        count: 0,
      });
    });
  });

  describe('getAllCharacters', () => {
    it('should return all characters', async () => {
      // Arrange
      const mockCharacters = [
        new Character({ eveId: '1', name: 'Test One', corporationId: 100 }),
        new Character({ eveId: '2', name: 'Test Two', corporationId: 200 }),
      ];
      
      mockCharacterRepository.getAllCharacters.mockResolvedValue(mockCharacters);
      (errorHandler.withRetry as jest.Mock).mockImplementation(async (fn) => await fn());

      // Act
      const result = await service.getAllCharacters();

      // Assert
      expect(result).toEqual(mockCharacters);
      expect(mockCharacterRepository.getAllCharacters).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('Successfully retrieved all characters', {
        correlationId: 'test-correlation-id',
        count: 2,
      });
    });
  });
});