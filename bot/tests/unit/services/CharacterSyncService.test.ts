import 'reflect-metadata';
import { CharacterSyncService } from '../../../src/services/ingestion/CharacterSyncService';
import { ESIService } from '../../../src/services/ESIService';
import { CharacterRepository } from '../../../src/infrastructure/repositories/CharacterRepository';
import { MapClient } from '../../../src/infrastructure/http/MapClient';
import { Character } from '../../../src/domain/character/Character';
import { logger } from '../../../src/lib/logger';
import { errorHandler, ExternalServiceError, ValidationError } from '../../../src/shared/errors';

// Mock dependencies
jest.mock('../../../src/lib/logger');
jest.mock('../../../src/services/ESIService');
jest.mock('../../../src/infrastructure/repositories/CharacterRepository');
jest.mock('../../../src/infrastructure/http/MapClient');
jest.mock('../../../src/infrastructure/persistence/client', () => ({
  default: {
    characterGroup: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock('../../../src/config/validated', () => ({
  ValidatedConfiguration: {
    apis: {
      map: {
        name: 'test-map',
      },
    },
  },
}));
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
jest.mock('../../../src/config/validated', () => ({
  ValidatedConfiguration: {
    apis: {
      map: {
        name: 'test-map',
      },
    },
  },
}));

// Mock ValidationError and ExternalServiceError
jest.mock('../../../src/shared/errors', () => ({
  ...jest.requireActual('../../../src/shared/errors'),
  ValidationError: {
    invalidFormat: jest.fn((field, format, value, context) => {
      const error = new Error(`Invalid format for ${field}: expected ${format}, got ${value}`);
      error.name = 'ValidationError';
      return error;
    }),
    missingRequiredField: jest.fn((field, context) => {
      const error = new Error(`Missing required field: ${field}`);
      error.name = 'ValidationError';
      return error;
    }),
  },
  ExternalServiceError: jest.fn().mockImplementation((service, message, context) => {
    const error = new Error(`${service}: ${message}`);
    error.name = 'ExternalServiceError';
    return error;
  }),
}));

describe('CharacterSyncService', () => {
  let characterSyncService: CharacterSyncService;
  let mockCharacterRepository: jest.Mocked<CharacterRepository>;
  let mockESIService: jest.Mocked<ESIService>;
  let mockMapClient: jest.Mocked<MapClient>;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked prisma client
    mockPrisma = jest.requireMock('../../../src/infrastructure/persistence/client').default;
    mockPrisma.characterGroup.findFirst.mockResolvedValue(null);
    mockPrisma.characterGroup.create.mockResolvedValue({ id: 1 });
    
    mockCharacterRepository = {
      getCharacter: jest.fn(),
      upsertCharacter: jest.fn(),
    } as any;
    
    mockESIService = {
      getCharacter: jest.fn(),
    } as any;
    
    mockMapClient = {
      getUserCharacters: jest.fn(),
    } as any;

    (CharacterRepository as jest.Mock).mockImplementation(() => mockCharacterRepository);
    (ESIService as jest.Mock).mockImplementation(() => mockESIService);
    (MapClient as jest.Mock).mockImplementation(() => mockMapClient);
    
    characterSyncService = new CharacterSyncService('http://test-api.com', 'test-key', 2, 1000);
  });

  describe('start', () => {
    it('should start character sync successfully', async () => {
      // Arrange
      const mockMapData = {
        data: [
          {
            characters: [
              {
                eve_id: 123456,
                corporation_id: 98765432,
                corporation_ticker: 'TEST',
                alliance_id: 99999999,
                alliance_ticker: 'TALL',
              },
            ],
            main_character_eve_id: 123456,
          },
        ],
      };
      
      mockMapClient.getUserCharacters.mockResolvedValue(mockMapData);
      mockCharacterRepository.getCharacter.mockResolvedValue(null);
      mockESIService.getCharacter.mockResolvedValue({
        name: 'Test Character',
      });
      mockCharacterRepository.upsertCharacter.mockResolvedValue({} as Character);

      // Act
      await characterSyncService.start();

      // Assert
      expect(mockMapClient.getUserCharacters).toHaveBeenCalledWith('test-map');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Character sync service started successfully'),
        expect.any(Object)
      );
    });

    it('should handle empty map name', async () => {
      // Arrange
      jest.doMock('../../../src/config/validated', () => ({
        ValidatedConfiguration: {
          apis: {
            map: {
              name: '',
            },
          },
        },
      }));

      // Act
      await characterSyncService.start();

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        'MAP_NAME environment variable not set, skipping character sync',
        expect.any(Object)
      );
    });

    it('should handle invalid map name format', async () => {
      // Arrange
      jest.doMock('../../../src/config/validated', () => ({
        ValidatedConfiguration: {
          apis: {
            map: {
              name: '   ',
            },
          },
        },
      }));

      // Act & Assert
      await expect(characterSyncService.start()).rejects.toThrow();
    });

    it('should handle map API errors', async () => {
      // Arrange
      const error = new Error('Map API error');
      mockMapClient.getUserCharacters.mockRejectedValue(error);

      // Act & Assert
      await expect(characterSyncService.start()).rejects.toThrow();
    });

    it('should handle empty map data', async () => {
      // Arrange
      mockMapClient.getUserCharacters.mockResolvedValue(null);

      // Act & Assert
      await expect(characterSyncService.start()).rejects.toThrow('Map API: No data returned from Map API');
    });

    it('should handle invalid map data structure', async () => {
      // Arrange
      mockMapClient.getUserCharacters.mockResolvedValue({
        data: 'invalid-data',
      });

      // Act
      await characterSyncService.start();

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No valid character data available'),
        expect.any(Object)
      );
    });
  });

  describe('syncUserCharacters', () => {
    it('should sync user characters successfully', async () => {
      // Arrange
      const mockMapData = {
        data: [
          {
            characters: [
              {
                eve_id: 123456,
                corporation_id: 98765432,
                corporation_ticker: 'TEST',
                alliance_id: 99999999,
                alliance_ticker: 'TALL',
              },
            ],
          },
        ],
      };
      
      mockCharacterRepository.getCharacter.mockResolvedValue(null);
      mockESIService.getCharacter.mockResolvedValue({
        name: 'Test Character',
      });
      mockCharacterRepository.upsertCharacter.mockResolvedValue({} as Character);

      // Act
      const result = await characterSyncService.syncUserCharacters(mockMapData);

      // Assert
      expect(result).toEqual({
        total: 1,
        synced: 1,
        skipped: 0,
        errors: 0,
      });
      expect(mockESIService.getCharacter).toHaveBeenCalledWith(123456);
      expect(mockCharacterRepository.upsertCharacter).toHaveBeenCalled();
    });

    it('should handle invalid map data', async () => {
      // Arrange
      const invalidMapData = {
        data: null,
      };

      // Act
      const result = await characterSyncService.syncUserCharacters(invalidMapData);

      // Assert
      expect(result).toEqual({
        total: 0,
        synced: 0,
        skipped: 0,
        errors: 0,
      });
    });

    it('should use existing character name for updates', async () => {
      // Arrange
      const mockMapData = {
        data: [
          {
            characters: [
              {
                eve_id: 123456,
                corporation_id: 98765432,
                corporation_ticker: 'TEST',
              },
            ],
          },
        ],
      };
      
      const existingCharacter = new Character({
        eveId: '123456',
        name: 'Existing Character',
        corporationId: 98765432,
        corporationTicker: 'TEST',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      mockCharacterRepository.getCharacter.mockResolvedValue(existingCharacter);
      mockCharacterRepository.upsertCharacter.mockResolvedValue({} as Character);

      // Act
      const result = await characterSyncService.syncUserCharacters(mockMapData);

      // Assert
      expect(result).toEqual({
        total: 1,
        synced: 1,
        skipped: 0,
        errors: 0,
      });
      expect(mockESIService.getCharacter).not.toHaveBeenCalled();
      expect(mockCharacterRepository.upsertCharacter).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Existing Character',
        })
      );
    });

    it('should skip characters with no ESI data', async () => {
      // Arrange
      const mockMapData = {
        data: [
          {
            characters: [
              {
                eve_id: 123456,
                corporation_id: 98765432,
                corporation_ticker: 'TEST',
              },
            ],
          },
        ],
      };
      
      mockCharacterRepository.getCharacter.mockResolvedValue(null);
      mockESIService.getCharacter.mockResolvedValue(null);

      // Act
      const result = await characterSyncService.syncUserCharacters(mockMapData);

      // Assert
      expect(result).toEqual({
        total: 1,
        synced: 0,
        skipped: 1,
        errors: 0,
      });
    });

    it('should handle sync errors', async () => {
      // Arrange
      const mockMapData = {
        data: [
          {
            characters: [
              {
                eve_id: 123456,
                corporation_id: 98765432,
                corporation_ticker: 'TEST',
              },
            ],
          },
        ],
      };
      
      mockCharacterRepository.getCharacter.mockResolvedValue(null);
      mockESIService.getCharacter.mockRejectedValue(new Error('ESI error'));

      // Act
      const result = await characterSyncService.syncUserCharacters(mockMapData);

      // Assert
      expect(result).toEqual({
        total: 1,
        synced: 0,
        skipped: 0,
        errors: 1,
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Error syncing character 123456',
        expect.any(Object)
      );
    });

    it('should handle users without characters', async () => {
      // Arrange
      const mockMapData = {
        data: [
          {
            characters: null,
          },
          {
            characters: [],
          },
        ],
      };

      // Act
      const result = await characterSyncService.syncUserCharacters(mockMapData);

      // Assert
      expect(result).toEqual({
        total: 0,
        synced: 0,
        skipped: 0,
        errors: 0,
      });
    });

    it('should deduplicate characters across users', async () => {
      // Arrange
      const mockMapData = {
        data: [
          {
            characters: [
              {
                eve_id: 123456,
                corporation_id: 98765432,
                corporation_ticker: 'TEST',
              },
            ],
          },
          {
            characters: [
              {
                eve_id: 123456, // Same character in different user group
                corporation_id: 98765432,
                corporation_ticker: 'TEST',
              },
            ],
          },
        ],
      };
      
      mockCharacterRepository.getCharacter.mockResolvedValue(null);
      mockESIService.getCharacter.mockResolvedValue({
        name: 'Test Character',
      });
      mockCharacterRepository.upsertCharacter.mockResolvedValue({} as Character);

      // Act
      const result = await characterSyncService.syncUserCharacters(mockMapData);

      // Assert
      expect(result).toEqual({
        total: 1, // Only one unique character
        synced: 1,
        skipped: 0,
        errors: 0,
      });
      expect(mockESIService.getCharacter).toHaveBeenCalledTimes(1);
    });
  });

  describe('close', () => {
    it('should close prisma connection', async () => {
      // Arrange
      const mockPrisma = {
        $disconnect: jest.fn(),
      };
      (characterSyncService as any).prisma = mockPrisma;

      // Act
      await characterSyncService.close();

      // Assert
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });
  });
});