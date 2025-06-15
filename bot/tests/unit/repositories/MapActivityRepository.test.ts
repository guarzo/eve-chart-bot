import { MapActivityRepository } from '../../../src/infrastructure/repositories/MapActivityRepository';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../src/lib/logger';
import { DatabaseError } from '../../../src/shared/errors';
import { MapActivity } from '../../../src/domain/activity/MapActivity';

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

// Mock Prisma Client
const mockPrismaClient = {
  mapActivity: {
    createMany: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  characterGroup: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(async (callback) => await callback(mockPrismaClient)),
} as unknown as PrismaClient;

describe('MapActivityRepository', () => {
  let repository: MapActivityRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new MapActivityRepository();
    // Inject the mock prisma client
    (repository as any).prisma = mockPrismaClient;
  });

  describe('getActivityForCharacter', () => {
    it('should retrieve activity for a single character', async () => {
      // Arrange
      const characterId = '1001';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const mockActivities = [
        {
          id: BigInt('1'),
          characterId: BigInt('1001'),
          solarSystemId: 30000142,
          systemName: 'Jita',
          regionId: 10000002,
          regionName: 'The Forge',
          signatures: 5,
          connections: 3,
          passages: 2,
          timestamp: new Date('2024-01-15T10:00:00Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      mockPrismaClient.mapActivity.findMany.mockResolvedValue(mockActivities);

      // Act
      const result = await repository.getActivityForCharacter(characterId, startDate, endDate);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(MapActivity);
      expect(result[0].characterId).toBe(BigInt('1001'));
      expect(result[0].signatures).toBe(5);
      expect(mockPrismaClient.mapActivity.findMany).toHaveBeenCalledWith({
        where: {
          characterId: BigInt(characterId),
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { timestamp: 'desc' },
      });
    });
  });

  describe('getActivityForCharacters', () => {
    it('should retrieve activity for multiple characters', async () => {
      // Arrange
      const characterIds = ['1001', '1002'];
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const mockActivities = [
        {
          id: BigInt('1'),
          characterId: BigInt('1001'),
          signatures: 5,
          connections: 3,
          passages: 2,
          timestamp: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: BigInt('2'),
          characterId: BigInt('1002'),
          signatures: 3,
          connections: 2,
          passages: 1,
          timestamp: new Date('2024-01-15T11:00:00Z'),
        },
      ];
      
      mockPrismaClient.mapActivity.findMany.mockResolvedValue(mockActivities);

      // Act
      const result = await repository.getActivityForCharacters(characterIds, startDate, endDate);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(MapActivity);
      expect(mockPrismaClient.mapActivity.findMany).toHaveBeenCalledWith({
        where: {
          characterId: { in: [BigInt('1001'), BigInt('1002')] },
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should filter out invalid character IDs', async () => {
      // Arrange
      const characterIds = ['1001', '', 'undefined', 'null', '1002'];
      mockPrismaClient.mapActivity.findMany.mockResolvedValue([]);

      // Act
      const result = await repository.getActivityForCharacters(characterIds, new Date(), new Date());

      // Assert
      expect(result).toEqual([]);
      expect(mockPrismaClient.mapActivity.findMany).toHaveBeenCalledWith({
        where: {
          characterId: { in: [BigInt('1001'), BigInt('1002')] },
          timestamp: expect.any(Object),
        },
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should handle empty results', async () => {
      // Arrange
      mockPrismaClient.mapActivity.findMany.mockResolvedValue([]);

      // Act
      const result = await repository.getActivityForCharacters(['1001'], new Date(), new Date());

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getActivityForGroup', () => {
    it('should retrieve activity for a group', async () => {
      // Arrange
      const groupId = 'group-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      mockPrismaClient.characterGroup.findUnique.mockResolvedValue({
        id: groupId,
        characters: [
          { eveId: BigInt('1001'), name: 'Char 1' },
          { eveId: BigInt('1002'), name: 'Char 2' },
        ],
      });
      
      // Mock the getActivityForCharacters call
      const mockActivities = [
        {
          characterId: BigInt('1001'),
          timestamp: new Date('2024-01-15T10:00:00Z'),
          signatures: 5,
          connections: 3,
          passages: 2,
        },
      ];
      
      mockPrismaClient.mapActivity.findMany.mockResolvedValue(mockActivities);

      // Act
      const result = await repository.getActivityForGroup(groupId, startDate, endDate);

      // Assert
      expect(result).toHaveLength(1);
      expect(mockPrismaClient.characterGroup.findUnique).toHaveBeenCalledWith({
        where: { id: groupId },
        include: { characters: true },
      });
    });

    it('should return empty array if group not found', async () => {
      // Arrange
      mockPrismaClient.characterGroup.findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.getActivityForGroup('non-existent', new Date(), new Date());

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('upsertMapActivity', () => {
    it('should upsert activity successfully', async () => {
      // Arrange
      const characterId = BigInt('1001');
      const timestamp = new Date('2024-01-01T10:00:00Z');
      const signatures = 5;
      const connections = 3;
      const passages = 2;
      const allianceId = 99999999;
      const corporationId = 98765432;

      mockPrismaClient.mapActivity.upsert.mockResolvedValue({});

      // Act
      await repository.upsertMapActivity(
        characterId,
        timestamp,
        signatures,
        connections,
        passages,
        allianceId,
        corporationId
      );

      // Assert
      expect(mockPrismaClient.mapActivity.upsert).toHaveBeenCalledWith({
        where: {
          characterId_timestamp: {
            characterId,
            timestamp,
          },
        },
        update: {
          signatures,
          connections,
          passages,
          allianceId,
          corporationId,
        },
        create: {
          characterId,
          timestamp,
          signatures,
          connections,
          passages,
          allianceId,
          corporationId,
        },
      });
    });

    it('should handle null alliance ID', async () => {
      // Arrange
      mockPrismaClient.mapActivity.upsert.mockResolvedValue({});

      // Act
      await repository.upsertMapActivity(
        BigInt('1001'),
        new Date(),
        5,
        3,
        2,
        null,
        98765432
      );

      // Assert
      expect(mockPrismaClient.mapActivity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            allianceId: undefined,
          }),
          create: expect.objectContaining({
            allianceId: undefined,
          }),
        })
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockPrismaClient.mapActivity.upsert.mockRejectedValue(error);

      // Act & Assert
      await expect(repository.upsertMapActivity(
        BigInt('1001'),
        new Date(),
        5,
        3,
        2,
        null,
        98765432
      )).rejects.toThrow('Database connection failed');
    });
  });

  describe('deleteAllMapActivity', () => {
    it('should delete all map activity records', async () => {
      // Arrange
      mockPrismaClient.mapActivity.deleteMany.mockResolvedValue({ count: 100 });

      // Act
      await repository.deleteAllMapActivity();

      // Assert
      expect(mockPrismaClient.mapActivity.deleteMany).toHaveBeenCalledWith();
      expect(logger.debug).toHaveBeenCalledWith(
        'Successfully deleted all map activity records',
        expect.objectContaining({
          deletedCount: 100,
        })
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      const error = new Error('Database error');
      mockPrismaClient.mapActivity.deleteMany.mockRejectedValue(error);

      // Act & Assert
      await expect(repository.deleteAllMapActivity()).rejects.toThrow('Database error');
    });
  });

  describe('getGroupActivityStats', () => {
    it('should calculate activity statistics for a group', async () => {
      // Arrange
      const groupId = 'group-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      mockPrismaClient.characterGroup.findUnique.mockResolvedValue({
        id: groupId,
        characters: [
          { eveId: BigInt('1001') },
          { eveId: BigInt('1002') },
        ],
      });
      
      const mockActivities = [
        { signatures: 5, timestamp: new Date(), characterId: BigInt('1001') },
        { signatures: 3, timestamp: new Date(), characterId: BigInt('1001') },
        { signatures: 2, timestamp: new Date(), characterId: BigInt('1002') },
      ];
      
      mockPrismaClient.mapActivity.findMany.mockResolvedValue(mockActivities);

      // Act
      const result = await repository.getGroupActivityStats(groupId, startDate, endDate);

      // Assert
      expect(result).toEqual({
        totalSystems: 3, // Using activity count as proxy
        totalSignatures: 10,
        averageSignaturesPerSystem: 10 / 3,
      });
    });

    it('should handle group with no activities', async () => {
      // Arrange
      mockPrismaClient.characterGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        characters: [{ eveId: BigInt('1001') }],
      });
      mockPrismaClient.mapActivity.findMany.mockResolvedValue([]);

      // Act
      const result = await repository.getGroupActivityStats('group-1', new Date(), new Date());

      // Assert
      expect(result).toEqual({
        totalSystems: 0,
        totalSignatures: 0,
        averageSignaturesPerSystem: 0,
      });
    });
  });

  describe('count', () => {
    it('should count total map activity records', async () => {
      // Arrange
      mockPrismaClient.mapActivity.count.mockResolvedValue(1000);

      // Act
      const result = await repository.count();

      // Assert
      expect(result).toBe(1000);
      expect(mockPrismaClient.mapActivity.count).toHaveBeenCalled();
    });

    it('should handle zero records', async () => {
      // Arrange
      mockPrismaClient.mapActivity.count.mockResolvedValue(0);

      // Act
      const result = await repository.count();

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('getActivityGroupedByTime', () => {
    it('should group activities by day', async () => {
      // Arrange
      const characterIds = ['1001', '1002'];
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const mockActivities = [
        {
          characterId: BigInt('1001'),
          timestamp: new Date('2024-01-15T10:00:00Z'),
          signatures: 5,
        },
        {
          characterId: BigInt('1001'),
          timestamp: new Date('2024-01-15T14:00:00Z'),
          signatures: 3,
        },
        {
          characterId: BigInt('1002'),
          timestamp: new Date('2024-01-16T09:00:00Z'),
          signatures: 2,
        },
      ];
      
      mockPrismaClient.mapActivity.findMany.mockResolvedValue(mockActivities);

      // Act
      const result = await repository.getActivityGroupedByTime(characterIds, startDate, endDate, 'day');

      // Assert
      expect(result).toHaveLength(2); // Two different days
      expect(result[0].signatures).toBe(8); // 5 + 3 for Jan 15
      expect(result[1].signatures).toBe(2); // 2 for Jan 16
    });
  });
});