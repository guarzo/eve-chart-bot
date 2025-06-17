import { ChartService } from '../../../src/application/chart/ChartService';
import { CharacterRepository } from '../../../src/infrastructure/repositories/CharacterRepository';
import { KillRepository } from '../../../src/infrastructure/repositories/KillRepository';
import { MapActivityRepository } from '../../../src/infrastructure/repositories/MapActivityRepository';
import { RepositoryManager } from '../../../src/infrastructure/repositories/RepositoryManager';
import { ChartConfigInput, ChartData } from '../../../src/types/chart';
import { Character } from '../../../src/domain/character/Character';
import { CharacterGroup } from '../../../src/domain/character/CharacterGroup';
import { logger } from '../../../src/lib/logger';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
jest.mock('../../../src/lib/logger');
jest.mock('@prisma/client');
jest.mock('../../../src/infrastructure/repositories/RepositoryManager');

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    quit: jest.fn(),
  }));
});
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
    handleChartError: jest.fn((error) => { throw error; }),
  };
  
  return {
    ErrorHandler: {
      getInstance: jest.fn(() => mockErrorHandler)
    },
    errorHandler: mockErrorHandler
  };
});

describe('ChartService', () => {
  let service: ChartService;
  let mockCharacterRepo: jest.Mocked<CharacterRepository>;
  let mockKillRepo: jest.Mocked<KillRepository>;
  let mockMapActivityRepo: jest.Mocked<MapActivityRepository>;
  let mockRepoManager: jest.Mocked<RepositoryManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockCharacterRepo = {
      getCharacter: jest.fn(),
      getAllCharacters: jest.fn(),
      getCharactersByGroup: jest.fn(),
      getAllCharacterGroups: jest.fn(),
      getCharacterGroup: jest.fn(),
    } as any;

    mockKillRepo = {
      getKillsForCharacters: jest.fn(),
      getKillsForGroup: jest.fn(),
    } as any;

    mockMapActivityRepo = {
      getActivityForCharacters: jest.fn(),
      getActivityForGroup: jest.fn(),
      getGroupActivityStats: jest.fn(),
    } as any;

    mockRepoManager = {
      getCharacterRepository: jest.fn(() => mockCharacterRepo),
      getKillRepository: jest.fn(() => mockKillRepo),
      getMapActivityRepository: jest.fn(() => mockMapActivityRepo),
    } as any;

    (RepositoryManager as jest.MockedClass<typeof RepositoryManager>).mockImplementation(() => mockRepoManager);

    // Create service instance
    service = new ChartService();
  });

  describe('generateChart', () => {
    const baseConfig: ChartConfigInput = {
      type: 'kills',
      characterIds: [BigInt('1001'), BigInt('1002')],
      period: '7d',
      groupBy: 'day',
      displayType: 'line',
      displayMetric: 'value',
      limit: 10,
    };

    it('should generate a kills chart', async () => {
      // Arrange
      const mockCharacter1 = new Character({
        eveId: '1001',
        name: 'Test Character 1',
        corporationId: 98765
      });
      const mockCharacter2 = new Character({
        eveId: '1002',
        name: 'Test Character 2',
        corporationId: 98766
      });

      mockCharacterRepo.getCharacter.mockResolvedValueOnce(mockCharacter1);
      mockCharacterRepo.getCharacter.mockResolvedValueOnce(mockCharacter2);
      mockCharacterRepo.getCharactersByGroup.mockResolvedValue([]);
      
      const mockKills = [
        {
          kill_time: new Date('2024-01-15'),
          total_value: BigInt('1000000'),
          points: 10,
          attacker_count: 5,
          character_id: '1001',
        },
        {
          kill_time: new Date('2024-01-16'),
          total_value: BigInt('2000000'),
          points: 20,
          attacker_count: 3,
          character_id: '1002',
        },
      ];
      
      mockKillRepo.getKillsForCharacters.mockResolvedValue(mockKills);

      // Act
      const result = await service.generateChart(baseConfig);

      // Assert
      expect(result).toBeDefined();
      expect(result.title).toContain('Kills - ISK Value - Last 7 Days');
      expect(result.displayType).toBe('line');
      expect(result.labels).toBeDefined();
      expect(result.datasets).toBeDefined();
      expect(mockKillRepo.getKillsForCharacters).toHaveBeenCalledWith(
        [BigInt('1001'), BigInt('1002')],
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should generate a map activity chart', async () => {
      // Arrange
      const mapConfig: ChartConfigInput = {
        ...baseConfig,
        type: 'map_activity',
      };
      
      const mockCharacter = new Character({
        eveId: '1001',
        name: 'Test Character',
        corporationId: 98765
      });
      
      mockCharacterRepo.getCharacter.mockResolvedValue(mockCharacter);
      mockCharacterRepo.getCharactersByGroup.mockResolvedValue([]);
      
      const mockActivity = [
        {
          timestamp: new Date('2024-01-15T10:00:00Z'),
          signatures: 5,
          characterId: '1001',
        },
        {
          timestamp: new Date('2024-01-15T11:00:00Z'),
          signatures: 3,
          characterId: '1001',
        },
      ];
      
      mockMapActivityRepo.getActivityForGroup.mockResolvedValue(mockActivity);

      // Act
      const result = await service.generateChart(mapConfig);

      // Assert
      expect(result).toBeDefined();
      expect(result.title).toContain('Map Activity - ISK Value - Last 7 Days');
      expect(mockMapActivityRepo.getActivityForGroup).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockCharacterRepo.getCharacter.mockImplementation(() => {
        throw new Error('Database error');
      });
      mockCharacterRepo.getCharactersByGroup.mockResolvedValue([]);
      mockKillRepo.getKillsForCharacters.mockResolvedValue([]);

      // Act
      const result = await service.generateChart(baseConfig);

      // Assert - generateKillsChart returns empty data on error
      expect(result.datasets).toEqual([]);
      expect(result.labels).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error generating kills chart:'), expect.any(Error));
    });

    it('should validate chart configuration', async () => {
      // Arrange
      const invalidConfig = {
        ...baseConfig,
        type: null as any,
      };

      // Act & Assert
      await expect(service.generateChart(invalidConfig)).rejects.toThrow();
    });

    it('should handle empty character IDs', async () => {
      // Arrange
      const emptyConfig = {
        ...baseConfig,
        characterIds: [],
      };

      // Act
      const result = await service.generateChart(emptyConfig);

      // Assert - Empty character IDs should return empty data
      expect(result.datasets).toEqual([]);
      expect(result.labels).toEqual([]);
      expect(result.title).toContain('Kills');
      expect(result.displayType).toBe('line');
    });
  });

  describe('generateGroupedKillsChart', () => {
    it('should generate a grouped kills chart', async () => {
      // Arrange
      const characterGroups = [
        {
          groupId: 'group-1',
          name: 'Group 1',
          characters: [
            { eveId: '1001', name: 'Char 1' },
            { eveId: '1002', name: 'Char 2' },
          ],
        },
        {
          groupId: 'group-2',
          name: 'Group 2',
          characters: [
            { eveId: '2001', name: 'Char 3' },
            { eveId: '2002', name: 'Char 4' },
          ],
        },
      ];
      
      const mockKills = [
        {
          kill_time: new Date('2024-01-15'),
          attackers: [
            { character_id: '1001' },
            { character_id: '2001' },
          ],
        },
      ];
      
      mockCharacterRepo.getCharactersByGroup.mockResolvedValue([]);
      mockKillRepo.getKillsForCharacters.mockResolvedValue(mockKills);

      // Act
      const result = await service.generateGroupedKillsChart({
        characterGroups,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        displayType: 'horizontalBar',
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.displayType).toBe('horizontalBar');
      expect(result.datasets).toHaveLength(2); // Total and Solo kills
    });

    it('should handle empty character groups', async () => {
      // Act
      const result = await service.generateGroupedKillsChart({
        characterGroups: [],
        startDate: new Date(),
        endDate: new Date(),
        displayType: 'horizontalBar',
      });

      // Assert
      expect(result.labels).toEqual([]);
      expect(result.datasets).toEqual([]);
    });
  });

  describe('getTrackedCharacters', () => {
    it('should return tracked characters', async () => {
      // Arrange
      const mockGroups = [
        new CharacterGroup({
          id: 'group-1',
          map_name: 'Group 1',
          mainCharacterId: '1001',
          characters: [
            new Character({ eveId: '1001', name: 'Main Char', corporationId: 100 }),
            new Character({ eveId: '1002', name: 'Alt Char', corporationId: 100 }),
          ] as Character[],
        }),
      ];
      
      mockCharacterRepo.getAllCharacterGroups.mockResolvedValue(mockGroups);

      // Act
      const result = await service.getTrackedCharacters();

      // Assert
      expect(result).toHaveLength(1);  // Should find the main character
      expect(result[0].eveId).toBe('1001');
      expect(result[0].name).toBe('Main Char');
    });

    it('should handle errors and return empty array', async () => {
      // Arrange
      mockCharacterRepo.getAllCharacterGroups.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await service.getTrackedCharacters();

      // Assert
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getCharacterGroups', () => {
    it('should return character groups', async () => {
      // Arrange
      const mockGroups = [
        new CharacterGroup({
          id: 'group-1',
          map_name: 'Group 1',
          mainCharacterId: '1001',
          characters: [
            new Character({ eveId: '1001', name: 'Char 1', corporationId: 100 }),
            new Character({ eveId: '1002', name: 'Char 2', corporationId: 100 }),
          ],
        }),
      ];
      
      mockCharacterRepo.getAllCharacterGroups.mockResolvedValue(mockGroups);

      // Act
      const result = await service.getCharacterGroups();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].groupId).toBe('group-1');
      expect(result[0].characters).toHaveLength(2);
    });

    it('should filter out groups with no characters', async () => {
      // Arrange
      const mockGroups = [
        new CharacterGroup({
          id: 'group-1',
          map_name: 'Group 1',
          characters: [],
        }),
        new CharacterGroup({
          id: 'group-2',
          map_name: 'Group 2',
          characters: [
            new Character({ eveId: '2001', name: 'Char', corporationId: 100 }),
          ],
        }),
      ];
      
      mockCharacterRepo.getAllCharacterGroups.mockResolvedValue(mockGroups);

      // Act
      const result = await service.getCharacterGroups();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].groupId).toBe('group-2');
    });
  });

  describe('getAllCharacters', () => {
    it('should return all characters', async () => {
      // Arrange
      const mockCharacters = [
        new Character({ eveId: '1', name: 'Test One', corporationId: 100 }),
        new Character({ eveId: '2', name: 'Test Two', corporationId: 200 }),
      ];
      
      mockCharacterRepo.getAllCharacters.mockResolvedValue(mockCharacters);

      // Act
      const result = await service.getAllCharacters();

      // Assert
      expect(result).toEqual(mockCharacters);
      expect(mockCharacterRepo.getAllCharacters).toHaveBeenCalled();
    });
  });
});