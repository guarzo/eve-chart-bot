import { KillRepository } from '../../../src/infrastructure/repositories/KillRepository';
import { PrismaClient } from '@prisma/client';
import { KillFactData, VictimData, AttackerData, InvolvedCharacterData } from '../../../src/shared/types/database';
import { logger } from '../../../src/lib/logger';
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

// Mock Prisma Client
const mockPrismaClient = {
  killFact: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  killVictim: {
    create: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  killAttacker: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
  },
  killFactCharacters: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  lossFact: {
    create: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  killFactItem: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  killCharacter: {
    count: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  character: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(async (callback) => await callback(mockPrismaClient)),
} as unknown as PrismaClient;

describe('KillRepository', () => {
  let repository: KillRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new KillRepository(mockPrismaClient);
  });

  describe('ingestKillmail', () => {
    const mockKillFact: KillFactData = {
      killmailId: BigInt('123456'),
      killTime: new Date('2024-01-01T00:00:00Z'),
      solarSystemId: 30000142,
      x: 100.5,
      y: 200.5,
      z: 300.5,
      npc: false,
      awox: false,
      solo: false,
      pointValue: 10.5,
      totalValue: BigInt('1000000'),
    };
    
    const mockVictim: VictimData = {
      killmailId: BigInt('123456'),
      characterId: BigInt('1001'),
      corporationId: BigInt('2001'),
      allianceId: BigInt('3001'),
      damageTaken: 5000,
      shipTypeId: 587,
    };
    
    const mockAttackers: AttackerData[] = [
      {
        killmailId: BigInt('123456'),
        characterId: BigInt('2002'),
        corporationId: BigInt('2002'),
        allianceId: null,
        damageDone: 3000,
        finalBlow: true,
        shipTypeId: 621,
        weaponTypeId: 3074,
        securityStatus: 5.0,
      },
    ];
    
    const mockInvolvedCharacters: InvolvedCharacterData[] = [
      { killmailId: BigInt('123456'), characterId: BigInt('1001') },
      { killmailId: BigInt('123456'), characterId: BigInt('2002') },
    ];

    it('should successfully ingest a killmail', async () => {
      // Arrange
      mockPrismaClient.killFact.upsert.mockResolvedValue({
        killmailId: BigInt('123456'),
        killTime: new Date('2024-01-01T00:00:00Z'),
        solarSystemId: 30000142,
        x: 100.5,
        y: 200.5,
        z: 300.5,
        npc: false,
        awox: false,
        solo: false,
        pointValue: 10.5,
        totalValue: BigInt('1000000'),
      });
      
      mockPrismaClient.killVictim.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.killVictim.create.mockResolvedValue({});
      mockPrismaClient.killAttacker.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.killAttacker.create.mockResolvedValue({});
      mockPrismaClient.killCharacter.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.killCharacter.createMany.mockResolvedValue({ count: 2 });
      mockPrismaClient.killFactCharacters.createMany.mockResolvedValue({ count: 2 });
      mockPrismaClient.character.findUnique.mockResolvedValue({ eveId: BigInt('1001') });
      mockPrismaClient.lossFact.upsert.mockResolvedValue({
        id: BigInt('1'),
        killFactId: BigInt('123456'),
        characterId: BigInt('1001'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await repository.ingestKillmail(mockKillFact, mockVictim, mockAttackers, mockInvolvedCharacters);

      // Assert
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(mockPrismaClient.killFact.upsert).toHaveBeenCalledWith({
        where: { killmailId: BigInt('123456') },
        create: expect.objectContaining({
          killmailId: BigInt('123456'),
          killTime: new Date('2024-01-01T00:00:00Z'),
        }),
        update: expect.objectContaining({
          killTime: new Date('2024-01-01T00:00:00Z'),
        }),
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Killmail 123456 ingested successfully'),
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          duration: expect.any(Number),
          involvedCount: 2,
          attackerCount: 1,
        })
      );
    });

    it('should handle duplicate killmail gracefully', async () => {
      // Arrange
      const duplicateError = new Error('Unique constraint failed');
      (duplicateError as any).code = 'P2002';
      mockPrismaClient.killFact.upsert.mockRejectedValue(duplicateError);

      // Act & Assert
      await expect(repository.ingestKillmail(mockKillFact, mockVictim, mockAttackers, mockInvolvedCharacters)).rejects.toThrow();
    });

    it('should create loss fact for tracked victim', async () => {
      // Arrange
      const trackedVictim = {
        ...mockVictim,
        characterId: BigInt('1001'), // Victim is tracked
      };

      mockPrismaClient.killFact.upsert.mockResolvedValue({
        killmailId: BigInt('123456'),
        killTime: new Date('2024-01-01T00:00:00Z'),
      } as any);
      mockPrismaClient.killVictim.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.killVictim.create.mockResolvedValue({});
      mockPrismaClient.killAttacker.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.killAttacker.create.mockResolvedValue({});
      mockPrismaClient.killCharacter.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.killCharacter.createMany.mockResolvedValue({ count: 2 });
      mockPrismaClient.killFactCharacters.createMany.mockResolvedValue({ count: 2 });
      mockPrismaClient.character.findUnique.mockResolvedValue({ eveId: BigInt('1001') });
      mockPrismaClient.lossFact.upsert.mockResolvedValue({});

      // Act
      await repository.ingestKillmail(mockKillFact, trackedVictim, mockAttackers, mockInvolvedCharacters);

      // Assert
      expect(mockPrismaClient.lossFact.upsert).toHaveBeenCalled();
    });
  });

  describe('getKillsForCharacters', () => {
    it('should return kills for a character', async () => {
      // Arrange
      const characterId = BigInt('1001');
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const mockKills = [
        {
          killmailId: BigInt('123'),
          killTime: new Date('2024-01-15'),
          victim: { characterId: BigInt('9999') },
          attackers: [{ characterId: BigInt('1001') }],
        },
      ];
      
      mockPrismaClient.killFact.findMany.mockResolvedValue(mockKills as any);

      // Act
      const result = await repository.getKillsForCharacters([characterId], startDate, endDate);

      // Assert
      expect(result).toHaveLength(1);
      expect(mockPrismaClient.killFact.findMany).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      // Arrange
      mockPrismaClient.killFact.findMany.mockResolvedValue([]);

      // Act
      const result = await repository.getKillsForCharacters([BigInt('1001')], new Date(), new Date());

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('getLossCount', () => {
    it('should return loss count for a character', async () => {
      // Arrange
      const characterId = BigInt('1001');
      const lossCount = 5;
      
      mockPrismaClient.killCharacter.count.mockResolvedValue(lossCount);

      // Act
      const result = await repository.getLossCount(characterId);

      // Assert
      expect(result).toBe(lossCount);
      expect(mockPrismaClient.killCharacter.count).toHaveBeenCalledWith({
        where: {
          characterId,
          role: 'victim',
          kill: {
            killTime: {
              gte: undefined,
              lte: undefined,
            },
          },
        },
      });
    });
  });

  describe('getTopKillers', () => {
    it('should return top killers (placeholder implementation)', async () => {
      // Arrange
      const limit = 10;
      const mockResult: any[] = [];

      // Act
      const result = await repository.getTopKillers(limit);

      // Assert
      expect(result).toEqual(mockResult);
    });
  });

  describe('getKillCount', () => {
    it('should return kill count for a character', async () => {
      // Arrange
      const characterId = BigInt('1001');
      const killCount = 25;
      
      mockPrismaClient.killCharacter.count.mockResolvedValue(killCount);

      // Act
      const result = await repository.getKillCount(characterId);

      // Assert
      expect(result).toBe(killCount);
      expect(mockPrismaClient.killCharacter.count).toHaveBeenCalledWith({
        where: {
          characterId,
          role: 'attacker',
          kill: {
            killTime: {
              gte: undefined,
              lte: undefined,
            },
          },
        },
      });
    });

    it('should handle zero kills', async () => {
      // Arrange
      mockPrismaClient.killCharacter.count.mockResolvedValue(0);

      // Act
      const result = await repository.getKillCount(BigInt('1001'));

      // Assert
      expect(result).toBe(0);
    });
  });

  // Note: deleteKillmail method doesn't exist in the current KillRepository implementation
  // These tests are commented out until the method is implemented
  /*
  describe('deleteKillmail', () => {
    it('should delete a killmail and related data', async () => {
      // Test implementation needed when deleteKillmail is added
    });

    it('should handle non-existent killmail', async () => {
      // Test implementation needed when deleteKillmail is added
    });
  });
  */
});