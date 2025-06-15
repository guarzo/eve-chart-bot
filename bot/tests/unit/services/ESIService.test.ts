import 'reflect-metadata';
import { ESIService } from '../../../src/services/ESIService';
import { UnifiedESIClient } from '../../../src/infrastructure/http/UnifiedESIClient';
import { CacheRedisAdapter } from '../../../src/cache/CacheRedisAdapter';
import { logger } from '../../../src/lib/logger';
import { errorHandler, ExternalServiceError, ValidationError } from '../../../src/shared/errors';

// Mock dependencies
jest.mock('../../../src/lib/logger');
jest.mock('../../../src/cache/CacheRedisAdapter');
jest.mock('../../../src/infrastructure/http/UnifiedESIClient');
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
    handleExternalServiceError: jest.fn((error) => { throw error; }),
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
    redis: {
      url: 'redis://localhost:6379',
      cacheTtl: 3600,
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

describe('ESIService', () => {
  let esiService: ESIService;
  let mockESIClient: jest.Mocked<UnifiedESIClient>;
  let mockCache: jest.Mocked<CacheRedisAdapter>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;
    
    mockESIClient = {
      fetchKillmail: jest.fn(),
      fetchCharacter: jest.fn(),
      fetchCorporation: jest.fn(),
      fetchAlliance: jest.fn(),
      fetchType: jest.fn(),
      fetchSolarSystem: jest.fn(),
    } as any;

    (CacheRedisAdapter as jest.Mock).mockImplementation(() => mockCache);
    (UnifiedESIClient as jest.Mock).mockImplementation(() => mockESIClient);
    
    esiService = new ESIService();
  });

  describe('getKillmail', () => {
    it('should fetch killmail data successfully', async () => {
      // Arrange
      const killmailId = 123456;
      const hash = 'test-hash';
      const mockKillmailData = {
        killmail_id: killmailId,
        victim: { character_id: 123 },
        attackers: [{ character_id: 456 }],
      };
      
      mockESIClient.fetchKillmail.mockResolvedValue(mockKillmailData);

      // Act
      const result = await esiService.getKillmail(killmailId, hash);

      // Assert
      expect(result).toEqual(mockKillmailData);
      expect(mockESIClient.fetchKillmail).toHaveBeenCalledWith(killmailId, hash);
      expect(logger.debug).toHaveBeenCalledWith('Fetching killmail from ESI', {
        correlationId: 'test-correlation-id',
        killmailId,
        hash,
      });
    });

    it('should throw ValidationError for invalid killmail ID', async () => {
      // Arrange
      const invalidKillmailId = 0;
      const hash = 'test-hash';

      // Act & Assert
      await expect(esiService.getKillmail(invalidKillmailId, hash))
        .rejects.toThrow('Invalid format for killmailId: expected positive integer, got 0');
    });

    it('should throw ValidationError for missing hash', async () => {
      // Arrange
      const killmailId = 123456;
      const hash = '';

      // Act & Assert
      await expect(esiService.getKillmail(killmailId, hash))
        .rejects.toThrow('Missing required field: hash');
    });

    it('should handle ESI client errors', async () => {
      // Arrange
      const killmailId = 123456;
      const hash = 'test-hash';
      const error = new Error('ESI API error');
      
      mockESIClient.fetchKillmail.mockRejectedValue(error);

      // Act & Assert
      await expect(esiService.getKillmail(killmailId, hash)).rejects.toThrow();
      expect(errorHandler.handleExternalServiceError).toHaveBeenCalledWith(
        error,
        'ESI',
        `killmail/${killmailId}/${hash}`,
        expect.any(Object)
      );
    });
  });

  describe('getCharacter', () => {
    it('should fetch character data successfully', async () => {
      // Arrange
      const characterId = 123456;
      const mockCharacterData = {
        name: 'Test Character',
        corporation_id: 98765432,
        alliance_id: 99999999,
      };
      
      mockESIClient.fetchCharacter.mockResolvedValue(mockCharacterData);

      // Act
      const result = await esiService.getCharacter(characterId);

      // Assert
      expect(result).toEqual(mockCharacterData);
      expect(mockESIClient.fetchCharacter).toHaveBeenCalledWith(characterId);
      expect(logger.debug).toHaveBeenCalledWith('Fetching character from ESI', {
        correlationId: 'test-correlation-id',
        characterId,
      });
    });

    it('should throw ValidationError for invalid character ID', async () => {
      // Arrange
      const invalidCharacterId = -1;

      // Act & Assert
      await expect(esiService.getCharacter(invalidCharacterId))
        .rejects.toThrow('Invalid format for characterId: expected positive integer, got -1');
    });

    it('should handle ESI client errors', async () => {
      // Arrange
      const characterId = 123456;
      const error = new Error('Character not found');
      
      mockESIClient.fetchCharacter.mockRejectedValue(error);

      // Act & Assert
      await expect(esiService.getCharacter(characterId)).rejects.toThrow();
      expect(errorHandler.handleExternalServiceError).toHaveBeenCalledWith(
        error,
        'ESI',
        `character/${characterId}`,
        expect.any(Object)
      );
    });
  });

  describe('getCorporation', () => {
    it('should fetch corporation data successfully', async () => {
      // Arrange
      const corporationId = 98765432;
      const mockCorporationData = {
        name: 'Test Corporation',
        ticker: 'TEST',
        alliance_id: 99999999,
      };
      
      mockESIClient.fetchCorporation.mockResolvedValue(mockCorporationData);

      // Act
      const result = await esiService.getCorporation(corporationId);

      // Assert
      expect(result).toEqual(mockCorporationData);
      expect(mockESIClient.fetchCorporation).toHaveBeenCalledWith(corporationId);
      expect(logger.debug).toHaveBeenCalledWith('Fetching corporation from ESI', {
        correlationId: 'test-correlation-id',
        corporationId,
      });
    });

    it('should throw ValidationError for invalid corporation ID', async () => {
      // Arrange
      const invalidCorporationId = 0;

      // Act & Assert
      await expect(esiService.getCorporation(invalidCorporationId))
        .rejects.toThrow('Invalid format for corporationId: expected positive integer, got 0');
    });
  });

  describe('getAlliance', () => {
    it('should fetch alliance data successfully', async () => {
      // Arrange
      const allianceId = 99999999;
      const mockAllianceData = {
        name: 'Test Alliance',
        ticker: 'TALL',
        executor_corporation_id: 98765432,
      };
      
      mockESIClient.fetchAlliance.mockResolvedValue(mockAllianceData);

      // Act
      const result = await esiService.getAlliance(allianceId);

      // Assert
      expect(result).toEqual(mockAllianceData);
      expect(mockESIClient.fetchAlliance).toHaveBeenCalledWith(allianceId);
      expect(logger.debug).toHaveBeenCalledWith('Fetching alliance from ESI', {
        correlationId: 'test-correlation-id',
        allianceId,
      });
    });

    it('should throw ValidationError for invalid alliance ID', async () => {
      // Arrange
      const invalidAllianceId = 0;

      // Act & Assert
      await expect(esiService.getAlliance(invalidAllianceId))
        .rejects.toThrow('Invalid format for allianceId: expected positive integer, got 0');
    });
  });

  describe('getShipType', () => {
    it('should fetch ship type data successfully', async () => {
      // Arrange
      const typeId = 587;
      const mockTypeData = {
        name: 'Rifter',
        group_id: 25,
        published: true,
      };
      
      mockESIClient.fetchType.mockResolvedValue(mockTypeData);

      // Act
      const result = await esiService.getShipType(typeId);

      // Assert
      expect(result).toEqual(mockTypeData);
      expect(mockESIClient.fetchType).toHaveBeenCalledWith(typeId);
      expect(logger.debug).toHaveBeenCalledWith('Fetching ship type from ESI', {
        correlationId: 'test-correlation-id',
        typeId,
      });
    });

    it('should throw ValidationError for invalid type ID', async () => {
      // Arrange
      const invalidTypeId = 0;

      // Act & Assert
      await expect(esiService.getShipType(invalidTypeId))
        .rejects.toThrow('Invalid format for typeId: expected positive integer, got 0');
    });
  });

  describe('getSolarSystem', () => {
    it('should fetch solar system data successfully', async () => {
      // Arrange
      const systemId = 30000142;
      const mockSystemData = {
        name: 'Jita',
        constellation_id: 20000020,
        security_status: 0.946,
      };
      
      mockESIClient.fetchSolarSystem.mockResolvedValue(mockSystemData);

      // Act
      const result = await esiService.getSolarSystem(systemId);

      // Assert
      expect(result).toEqual(mockSystemData);
      expect(mockESIClient.fetchSolarSystem).toHaveBeenCalledWith(systemId);
      expect(logger.debug).toHaveBeenCalledWith('Fetching solar system from ESI', {
        correlationId: 'test-correlation-id',
        systemId,
      });
    });

    it('should throw ValidationError for invalid system ID', async () => {
      // Arrange
      const invalidSystemId = 0;

      // Act & Assert
      await expect(esiService.getSolarSystem(invalidSystemId))
        .rejects.toThrow('Invalid format for systemId: expected positive integer, got 0');
    });
  });

  describe('getShipTypeNames', () => {
    it('should map ship type IDs to names', async () => {
      // Arrange
      const typeIds = [587, 588, 589];
      const mockTypeData = [
        { name: 'Rifter' },
        { name: 'Breacher' },
        { name: 'Burst' },
      ];
      
      mockESIClient.fetchType
        .mockResolvedValueOnce(mockTypeData[0])
        .mockResolvedValueOnce(mockTypeData[1])
        .mockResolvedValueOnce(mockTypeData[2]);

      // Act
      const result = await esiService.getShipTypeNames(typeIds);

      // Assert
      expect(result).toEqual({
        587: 'Rifter',
        588: 'Breacher',
        589: 'Burst',
      });
      expect(mockESIClient.fetchType).toHaveBeenCalledTimes(3);
    });

    it('should return cached results when available', async () => {
      // Arrange
      const typeIds = [587, 588];
      const cachedResult = { 587: 'Rifter', 588: 'Breacher' };
      
      mockCache.get.mockResolvedValue(cachedResult);

      // Act
      const result = await esiService.getShipTypeNames(typeIds);

      // Assert
      expect(result).toEqual(cachedResult);
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockESIClient.fetchType).not.toHaveBeenCalled();
    });

    it('should return empty object for empty array', async () => {
      // Arrange
      const typeIds: number[] = [];

      // Act
      const result = await esiService.getShipTypeNames(typeIds);

      // Assert
      expect(result).toEqual({});
      expect(mockESIClient.fetchType).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid input', async () => {
      // Act & Assert
      await expect(esiService.getShipTypeNames(null as any))
        .rejects.toThrow('Missing required field: typeIds');
    });

    it('should handle unknown ship types', async () => {
      // Arrange
      const typeIds = [999999];
      
      mockESIClient.fetchType.mockResolvedValue(null);

      // Act
      const result = await esiService.getShipTypeNames(typeIds);

      // Assert
      expect(result).toEqual({
        999999: 'Unknown Type 999999',
      });
    });
  });

  describe('getCorporationDetails', () => {
    it('should map corporation IDs to details', async () => {
      // Arrange
      const corpIds = [98765432, 98765433];
      const mockCorpData = [
        { name: 'Test Corp 1', ticker: 'TST1' },
        { name: 'Test Corp 2', ticker: 'TST2' },
      ];
      
      mockESIClient.fetchCorporation
        .mockResolvedValueOnce(mockCorpData[0])
        .mockResolvedValueOnce(mockCorpData[1]);

      // Act
      const result = await esiService.getCorporationDetails(corpIds);

      // Assert
      expect(result).toEqual({
        98765432: { name: 'Test Corp 1', ticker: 'TST1' },
        98765433: { name: 'Test Corp 2', ticker: 'TST2' },
      });
      expect(mockESIClient.fetchCorporation).toHaveBeenCalledTimes(2);
    });

    it('should return cached results when available', async () => {
      // Arrange
      const corpIds = [98765432];
      const cachedResult = { 98765432: { name: 'Cached Corp', ticker: 'CACHE' } };
      
      mockCache.get.mockResolvedValue(cachedResult);

      // Act
      const result = await esiService.getCorporationDetails(corpIds);

      // Assert
      expect(result).toEqual(cachedResult);
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockESIClient.fetchCorporation).not.toHaveBeenCalled();
    });

    it('should return empty object for empty array', async () => {
      // Arrange
      const corpIds: number[] = [];

      // Act
      const result = await esiService.getCorporationDetails(corpIds);

      // Assert
      expect(result).toEqual({});
      expect(mockESIClient.fetchCorporation).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid input', async () => {
      // Act & Assert
      await expect(esiService.getCorporationDetails(null as any))
        .rejects.toThrow('Missing required field: corpIds');
    });

    it('should handle unknown corporations', async () => {
      // Arrange
      const corpIds = [999999];
      
      mockESIClient.fetchCorporation.mockResolvedValue(null);

      // Act
      const result = await esiService.getCorporationDetails(corpIds);

      // Assert
      expect(result).toEqual({
        999999: { name: 'Unknown Corp 999999', ticker: '????' },
      });
    });
  });
});