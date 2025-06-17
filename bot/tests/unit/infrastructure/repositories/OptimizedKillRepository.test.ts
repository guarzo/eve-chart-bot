import { OptimizedKillRepository } from '../../../../src/infrastructure/repositories/OptimizedKillRepository';
import { PrismaClient } from '@prisma/client';

// Mock errorHandler
jest.mock('../../../../src/shared/errors', () => {
  const mockErrorHandler = {
    createCorrelationId: jest.fn(() => 'test-correlation-id'),
    withRetry: jest.fn(async (fn) => await fn()),
    handleError: jest.fn((error) => { throw error; }),
  };
  
  return {
    ...jest.requireActual('../../../../src/shared/errors'),
    ErrorHandler: {
      getInstance: jest.fn(() => mockErrorHandler)
    },
    errorHandler: mockErrorHandler
  };
});

// Mock PrismaClient
const mockPrismaClient = {
  $transaction: jest.fn(),
  killFact: {
    upsert: jest.fn(),
  },
  killVictim: {
    upsert: jest.fn(),
  },
  killAttacker: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  killCharacter: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  character: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  lossFact: {
    upsert: jest.fn(),
  },
} as unknown as PrismaClient;

describe('OptimizedKillRepository', () => {
  let repository: OptimizedKillRepository;
  let mockTransaction: any;

  beforeEach(() => {
    repository = new OptimizedKillRepository(mockPrismaClient);
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup transaction mock
    mockTransaction = {
      killFact: { upsert: jest.fn() },
      killVictim: { upsert: jest.fn() },
      killAttacker: { 
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      killCharacter: { 
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      character: { 
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      lossFact: { upsert: jest.fn() },
    };

    (mockPrismaClient.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return await callback(mockTransaction);
    });
  });

  const createTestData = () => ({
    killFact: {
      killmail_id: BigInt(123456),
      kill_time: new Date('2023-01-01'),
      npc: false,
      solo: true,
      awox: false,
      ship_type_id: 588,
      system_id: 30000142,
      labels: ['pvp'],
      total_value: BigInt(1000000),
      points: 10,
    },
    victim: {
      character_id: BigInt(987654),
      corporation_id: BigInt(111111),
      alliance_id: BigInt(222222),
      ship_type_id: 588,
      damage_taken: 1000,
    },
    attackers: [
      {
        character_id: BigInt(555555),
        corporation_id: BigInt(666666),
        alliance_id: BigInt(777777),
        damage_done: 800,
        final_blow: true,
        security_status: -5.0,
        ship_type_id: 671,
        weapon_type_id: 2488,
      },
      {
        character_id: BigInt(888888),
        corporation_id: BigInt(999999),
        damage_done: 200,
        final_blow: false,
        security_status: 0.5,
        ship_type_id: 672,
        weapon_type_id: 2489,
      },
    ],
    involvedCharacters: [
      { character_id: BigInt(987654), role: 'victim' as const },
      { character_id: BigInt(555555), role: 'attacker' as const },
      { character_id: BigInt(888888), role: 'attacker' as const },
    ],
  });

  describe('ingestKillmail', () => {
    it('should successfully ingest a killmail with optimized operations', async () => {
      const testData = createTestData();

      await repository.ingestKillmail(
        testData.killFact,
        testData.victim,
        testData.attackers,
        testData.involvedCharacters
      );

      // Verify transaction was called
      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(1);

      // Verify upsert operations were called
      expect(mockTransaction.killFact.upsert).toHaveBeenCalledWith({
        where: { killmail_id: testData.killFact.killmail_id },
        update: expect.objectContaining({
          kill_time: testData.killFact.kill_time,
          npc: testData.killFact.npc,
          solo: testData.killFact.solo,
        }),
        create: expect.objectContaining({
          killmail_id: testData.killFact.killmail_id,
          kill_time: testData.killFact.kill_time,
          npc: testData.killFact.npc,
        }),
      });

      expect(mockTransaction.killVictim.upsert).toHaveBeenCalledWith({
        where: { killmail_id: testData.killFact.killmail_id },
        update: expect.objectContaining({
          character_id: testData.victim.character_id,
          ship_type_id: testData.victim.ship_type_id,
        }),
        create: expect.objectContaining({
          killmail_id: testData.killFact.killmail_id,
          character_id: testData.victim.character_id,
        }),
      });
    });

    it('should handle attacker synchronization with diff-based updates', async () => {
      const testData = createTestData();

      // Mock existing attackers
      const existingAttackers = [
        {
          id: 1,
          killmail_id: testData.killFact.killmail_id,
          character_id: BigInt(555555),
          corporation_id: BigInt(666666),
          alliance_id: BigInt(777777),
          damage_done: 800,
          final_blow: true,
          security_status: -5.0,
          ship_type_id: 671,
          weapon_type_id: 2488,
        },
      ];

      mockTransaction.killAttacker.findMany.mockResolvedValue(existingAttackers);

      await repository.ingestKillmail(
        testData.killFact,
        testData.victim,
        testData.attackers,
        testData.involvedCharacters
      );

      // Verify attacker data was queried
      expect(mockTransaction.killAttacker.findMany).toHaveBeenCalledWith({
        where: { killmail_id: testData.killFact.killmail_id },
      });

      // Since we have 2 attackers in test data but only 1 existing, should create new ones
      expect(mockTransaction.killAttacker.createMany).toHaveBeenCalled();
    });

    it('should handle character relationship synchronization', async () => {
      const testData = createTestData();

      // Mock tracked characters
      const trackedCharacters = [
        { eveId: BigInt(987654) }, // victim
        { eveId: BigInt(555555) }, // attacker 1
      ];

      mockTransaction.character.findMany.mockResolvedValue(trackedCharacters);
      mockTransaction.killCharacter.findMany.mockResolvedValue([]);

      await repository.ingestKillmail(
        testData.killFact,
        testData.victim,
        testData.attackers,
        testData.involvedCharacters
      );

      // Verify tracked characters were queried efficiently
      expect(mockTransaction.character.findMany).toHaveBeenCalledWith({
        where: { 
          eveId: { 
            in: expect.arrayContaining([
              BigInt(987654), 
              BigInt(555555), 
              BigInt(888888)
            ])
          }
        },
        select: { eveId: true },
      });

      // Should create relationships for tracked characters only
      expect(mockTransaction.killCharacter.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            character_id: BigInt(987654),
            role: 'victim',
          }),
          expect.objectContaining({
            character_id: BigInt(555555),
            role: 'attacker',
          }),
        ]),
        skipDuplicates: true,
      });
    });

    it('should create loss fact for tracked victim', async () => {
      const testData = createTestData();

      // Mock tracked victim
      mockTransaction.character.findUnique.mockResolvedValue({ eveId: testData.victim.character_id });

      await repository.ingestKillmail(
        testData.killFact,
        testData.victim,
        testData.attackers,
        testData.involvedCharacters
      );

      // Verify loss fact was created
      expect(mockTransaction.lossFact.upsert).toHaveBeenCalledWith({
        where: { killmail_id: testData.killFact.killmail_id },
        update: expect.objectContaining({
          character_id: testData.victim.character_id,
          kill_time: testData.killFact.kill_time,
          attacker_count: testData.attackers.length,
        }),
        create: expect.objectContaining({
          killmail_id: testData.killFact.killmail_id,
          character_id: testData.victim.character_id,
          attacker_count: testData.attackers.length,
        }),
      });
    });

    it('should handle transaction errors gracefully', async () => {
      const testData = createTestData();

      // Mock transaction error
      (mockPrismaClient.$transaction as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        repository.ingestKillmail(
          testData.killFact,
          testData.victim,
          testData.attackers,
          testData.involvedCharacters
        )
      ).rejects.toThrow();
    });
  });

  describe('attackersEqual', () => {
    it('should correctly identify equal attackers', () => {
      const attacker1 = {
        characterId: BigInt(123),
        corporationId: BigInt(456),
        allianceId: BigInt(789),
        damageDone: 100,
        finalBlow: true,
        securityStatus: 0.5,
        shipTypeId: 588,
        weaponTypeId: 2488,
      };

      const attacker2 = { ...attacker1 };

      // Access private method through any cast for testing
      const isEqual = (repository as any).attackersEqual(attacker1, attacker2);
      expect(isEqual).toBe(true);
    });

    it('should correctly identify different attackers', () => {
      const attacker1 = {
        characterId: BigInt(123),
        corporationId: BigInt(456),
        allianceId: BigInt(789),
        damageDone: 100,
        finalBlow: true,
        securityStatus: 0.5,
        shipTypeId: 588,
        weaponTypeId: 2488,
      };

      const attacker2 = {
        ...attacker1,
        damageDone: 200, // Different damage
      };

      // Access private method through any cast for testing
      const isEqual = (repository as any).attackersEqual(attacker1, attacker2);
      expect(isEqual).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty attackers array', async () => {
      const testData = createTestData();
      testData.attackers = [];
      testData.involvedCharacters = [
        { character_id: BigInt(987654), role: 'victim' as const },
      ];

      mockTransaction.killAttacker.findMany.mockResolvedValue([]);

      await repository.ingestKillmail(
        testData.killFact,
        testData.victim,
        testData.attackers,
        testData.involvedCharacters
      );

      // Should not create any attackers
      expect(mockTransaction.killAttacker.createMany).not.toHaveBeenCalled();
    });

    it('should handle null character IDs in attackers', async () => {
      const testData = createTestData();
      testData.attackers[0].character_id = undefined;

      await repository.ingestKillmail(
        testData.killFact,
        testData.victim,
        testData.attackers,
        testData.involvedCharacters
      );

      // Should still process successfully
      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});