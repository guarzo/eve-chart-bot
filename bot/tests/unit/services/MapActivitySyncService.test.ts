import { MapActivityService } from '../../../src/services/ingestion/MapActivityService';
import { MapClient } from '../../../src/infrastructure/http/MapClient';
import { CharacterRepository } from '../../../src/infrastructure/repositories/CharacterRepository';
import { MapActivityRepository } from '../../../src/infrastructure/repositories/MapActivityRepository';
import { logger } from '../../../src/lib/logger';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
jest.mock('../../../src/lib/logger');
jest.mock('../../../src/infrastructure/http/MapClient');
jest.mock('../../../src/infrastructure/repositories/CharacterRepository');
jest.mock('../../../src/infrastructure/repositories/MapActivityRepository');
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
  };
  
  return {
    ErrorHandler: {
      getInstance: jest.fn(() => mockErrorHandler)
    },
    errorHandler: mockErrorHandler
  };
});

// Mock Prisma Client
const mockPrismaClient = {
  $transaction: jest.fn(async (callback) => await callback(mockPrismaClient)),
} as unknown as PrismaClient;

describe('MapActivityService', () => {
  let service: MapActivityService;
  let mockMapClient: jest.Mocked<MapClient>;
  let mockCharacterRepo: jest.Mocked<CharacterRepository>;
  let mockMapActivityRepo: jest.Mocked<MapActivityRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances
    mockMapClient = new MapClient() as jest.Mocked<MapClient>;
    mockCharacterRepo = new CharacterRepository() as jest.Mocked<CharacterRepository>;
    mockMapActivityRepo = new MapActivityRepository() as jest.Mocked<MapActivityRepository>;
    
    // Create service instance
    service = new MapActivityService(
      mockMapClient,
      mockCharacterRepo,
      mockMapActivityRepo
    );
  });

  describe('syncActivity', () => {
    it('should sync activity for all tracked characters', async () => {
      // Arrange
      const mockCharacters = [
        { eveId: '1001', name: 'Character 1' },
        { eveId: '1002', name: 'Character 2' },
      ];
      
      const mockActivityData = [
        {
          character_id: 1001,
          date: '2024-01-15',
          entries: [
            {
              timestamp: '2024-01-15T10:00:00Z',
              signatures: 5,
              connections: 3,
              passages: 2,
              alliance_id: 99999999,
              corporation_id: 98765432,
            },
          ],
        },
        {
          character_id: 1002,
          date: '2024-01-15',
          entries: [
            {
              timestamp: '2024-01-15T11:00:00Z',
              signatures: 3,
              connections: 2,
              passages: 1,
              alliance_id: 99999999,
              corporation_id: 98765432,
            },
          ],
        },
      ];
      
      mockCharacterRepo.getAllCharacters.mockResolvedValue(mockCharacters);
      mockMapClient.getActivityData.mockResolvedValue(mockActivityData);
      mockMapActivityRepo.upsertMapActivity.mockResolvedValue();

      // Act
      const result = await service.syncActivity();

      // Assert
      expect(result).toEqual({
        charactersProcessed: 2,
        activitiesCreated: 2,
        errors: [],
      });
      expect(mockCharacterRepo.getAllCharacters).toHaveBeenCalled();
      expect(mockMapClient.getActivityData).toHaveBeenCalledWith(
        ['1001', '1002'],
        expect.any(Date),
        expect.any(Date)
      );
      expect(mockMapActivityRepo.upsertMapActivity).toHaveBeenCalledTimes(2);
    });

    it('should handle empty character list', async () => {
      // Arrange
      mockCharacterRepo.getAllCharacters.mockResolvedValue([]);

      // Act
      const result = await service.syncActivity();

      // Assert
      expect(result).toEqual({
        charactersProcessed: 0,
        activitiesCreated: 0,
        errors: [],
      });
      expect(mockMapClient.getActivityData).not.toHaveBeenCalled();
    });

    it('should continue processing on individual character errors', async () => {
      // Arrange
      const mockCharacters = [
        { eveId: '1001', name: 'Character 1' },
        { eveId: '1002', name: 'Character 2' },
      ];
      
      const mockActivityData = [
        {
          character_id: 1001,
          date: '2024-01-15',
          entries: [
            {
              timestamp: '2024-01-15T10:00:00Z',
              signatures: 5,
              connections: 3,
              passages: 2,
              alliance_id: 99999999,
              corporation_id: 98765432,
            },
          ],
        },
      ];
      
      mockCharacterRepo.getAllCharacters.mockResolvedValue(mockCharacters);
      mockMapClient.getActivityData.mockResolvedValue(mockActivityData);
      
      // First upsert succeeds, second fails
      mockMapActivityRepo.upsertMapActivity
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error('Database error'));

      // Act
      const result = await service.syncActivity();

      // Assert
      expect(result.charactersProcessed).toBe(2);
      expect(result.activitiesCreated).toBe(1); // Only one succeeded
      expect(result.errors).toHaveLength(0); // Errors are logged but not returned
      expect(mockMapActivityRepo.upsertMapActivity).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      const mockCharacters = [{ eveId: '1001', name: 'Character 1' }];
      
      mockCharacterRepo.getAllCharacters.mockResolvedValue(mockCharacters);
      mockMapClient.getActivityData.mockRejectedValue(new Error('API error'));

      // Act
      const result = await service.syncActivity();

      // Assert
      expect(result).toEqual({
        charactersProcessed: 1,
        activitiesCreated: 0,
        errors: [],
      });
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to sync activity'),
        expect.any(Error)
      );
    });
  });

  describe('syncActivityForCharacter', () => {
    it('should sync activity for a specific character', async () => {
      // Arrange
      const characterId = '1001';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const mockActivityData = [
        {
          character_id: 1001,
          date: '2024-01-15',
          entries: [
            {
              timestamp: '2024-01-15T10:00:00Z',
              signatures: 5,
              connections: 3,
              passages: 2,
              alliance_id: 99999999,
              corporation_id: 98765432,
            },
          ],
        },
      ];
      
      mockMapClient.getActivityData.mockResolvedValue(mockActivityData);
      mockMapActivityRepo.upsertMapActivity.mockResolvedValue();

      // Act
      const result = await service.syncActivityForCharacter(characterId, startDate, endDate);

      // Assert
      expect(result).toBe(1);
      expect(mockMapClient.getActivityData).toHaveBeenCalledWith(
        [characterId],
        startDate,
        endDate
      );
      expect(mockMapActivityRepo.upsertMapActivity).toHaveBeenCalledWith(
        BigInt(characterId),
        new Date('2024-01-15T10:00:00Z'),
        5,
        3,
        2,
        99999999,
        98765432
      );
    });

    it('should handle activity with missing data', async () => {
      // Arrange
      const characterId = '1001';
      const mockActivityData = [
        {
          character_id: 1001,
          date: '2024-01-15',
          entries: [
            {
              timestamp: '2024-01-15T10:00:00Z',
              signatures: 5,
              // Missing connections and passages
            },
          ],
        },
      ];
      
      mockMapClient.getActivityData.mockResolvedValue(mockActivityData);
      mockMapActivityRepo.upsertMapActivity.mockResolvedValue();

      // Act
      const result = await service.syncActivityForCharacter(characterId, new Date(), new Date());

      // Assert
      expect(result).toBe(1);
      expect(mockMapActivityRepo.upsertMapActivity).toHaveBeenCalledWith(
        BigInt(characterId),
        new Date('2024-01-15T10:00:00Z'),
        5,
        0, // Default value for missing connections
        0, // Default value for missing passages
        undefined,
        undefined
      );
    });

    it('should return 0 when no activity data is returned', async () => {
      // Arrange
      mockMapClient.getActivityData.mockResolvedValue([]);

      // Act
      const result = await service.syncActivityForCharacter('1001', new Date(), new Date());

      // Assert
      expect(result).toBe(0);
      expect(mockMapActivityRepo.upsertMapActivity).not.toHaveBeenCalled();
    });
  });

  describe('syncCharacters', () => {
    it('should sync character data from map API', async () => {
      // Arrange
      const mockMapCharacters = [
        {
          id: 1001,
          name: 'Character 1',
          alliance_id: 99999999,
          alliance_ticker: 'TEST',
          corporation_id: 98765432,
          corporation_ticker: 'CORP',
        },
        {
          id: 1002,
          name: 'Character 2',
          alliance_id: null,
          alliance_ticker: null,
          corporation_id: 98765432,
          corporation_ticker: 'CORP',
        },
      ];
      
      mockMapClient.getCharacters.mockResolvedValue(mockMapCharacters);
      mockCharacterRepo.upsertCharacter.mockResolvedValue({});

      // Act
      const result = await service.syncCharacters();

      // Assert
      expect(result).toEqual({
        charactersCreated: 2,
        charactersUpdated: 0,
        errors: [],
      });
      expect(mockMapClient.getCharacters).toHaveBeenCalled();
      expect(mockCharacterRepo.upsertCharacter).toHaveBeenCalledTimes(2);
      expect(mockCharacterRepo.upsertCharacter).toHaveBeenCalledWith({
        eveId: BigInt(1001),
        name: 'Character 1',
        allianceId: 99999999,
        allianceTicker: 'TEST',
        corporationId: 98765432,
        corporationTicker: 'CORP',
      });
    });

    it('should handle API errors', async () => {
      // Arrange
      mockMapClient.getCharacters.mockRejectedValue(new Error('API error'));

      // Act & Assert
      await expect(service.syncCharacters()).rejects.toThrow('API error');
    });

    it('should handle upsert errors for individual characters', async () => {
      // Arrange
      const mockMapCharacters = [
        {
          id: 1001,
          name: 'Character 1',
          corporation_id: 98765432,
          corporation_ticker: 'CORP',
        },
        {
          id: 1002,
          name: 'Character 2',
          corporation_id: 98765432,
          corporation_ticker: 'CORP',
        },
      ];
      
      mockMapClient.getCharacters.mockResolvedValue(mockMapCharacters);
      mockCharacterRepo.upsertCharacter
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Database error'));

      // Act
      const result = await service.syncCharacters();

      // Assert
      expect(result.charactersCreated).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to upsert character 1002');
    });
  });
});