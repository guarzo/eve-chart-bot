import { PrismaClient } from '@prisma/client';
import { errorHandler, DatabaseError } from '../index';
import { logger } from '../../logger';

/**
 * Example: Enhanced repository with standardized error handling
 */
export class EnhancedKillRepository {
  constructor(private prisma: PrismaClient) {}

  async getKillsForCharacters(
    characterIds: bigint[],
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      return await errorHandler.withRetry(
        async () => {
          const result = await this.prisma.killFact.findMany({
            where: {
              characterId: { in: characterIds },
              killTime: { gte: startDate, lte: endDate },
            },
            include: {
              attackers: true,
              victims: true,
              characters: true,
            },
          });

          logger.debug('Database query successful', {
            correlationId,
            operation: 'getKillsForCharacters',
            characterCount: characterIds.length,
            resultCount: result.length,
            dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
          });

          return result;
        },
        3, // max attempts
        1000, // base delay
        {
          correlationId,
          operation: 'db.getKillsForCharacters',
          metadata: {
            table: 'kill_fact',
            characterIds: characterIds.map(id => id.toString()),
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        }
      );
    } catch (error) {
      throw errorHandler.handleDatabaseError(
        error,
        'select',
        'kill_fact',
        characterIds[0]?.toString(),
        {
          correlationId,
          includeStackTrace: true,
        }
      );
    }
  }

  async createKillFact(killData: any): Promise<any> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      return await this.prisma.killFact.create({
        data: killData,
      });
    } catch (error) {
      // Handle specific Prisma errors
      if (this.isPrismaConstraintError(error)) {
        throw DatabaseError.constraintViolation(
          this.extractConstraintName(error),
          'kill_fact',
          { correlationId },
          error as Error
        );
      }

      if (this.isPrismaNotFoundError(error)) {
        throw DatabaseError.recordNotFound(
          'kill_fact',
          killData.killmail_id?.toString() || 'unknown',
          { correlationId }
        );
      }

      if (this.isPrismaTimeoutError(error)) {
        throw DatabaseError.timeout(
          'create',
          'kill_fact',
          { correlationId }
        );
      }

      // Generic database error
      throw errorHandler.handleDatabaseError(
        error,
        'create',
        'kill_fact',
        killData.character_id?.toString(),
        { correlationId }
      );
    }
  }

  async updateCharacter(characterId: bigint, updateData: any): Promise<any> {
    const correlationId = errorHandler.createCorrelationId();

    try {
      // Use a transaction for complex updates
      return await this.prisma.$transaction(async (tx) => {
        // Check if character exists first
        const existingCharacter = await tx.character.findUnique({
          where: { id: characterId },
        });

        if (!existingCharacter) {
          throw DatabaseError.recordNotFound(
            'character',
            characterId.toString(),
            { correlationId }
          );
        }

        // Perform the update
        const updated = await tx.character.update({
          where: { id: characterId },
          data: updateData,
        });

        logger.info('Character updated successfully', {
          correlationId,
          characterId: characterId.toString(),
          updatedFields: Object.keys(updateData),
        });

        return updated;
      });
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error; // Re-throw our custom errors
      }

      throw errorHandler.handleDatabaseError(
        error,
        'update',
        'character',
        characterId.toString(),
        { correlationId }
      );
    }
  }

  async bulkInsertKills(killsData: any[]): Promise<void> {
    const correlationId = errorHandler.createCorrelationId();
    const batchSize = 100;

    try {
      // Process in batches to avoid memory issues
      for (let i = 0; i < killsData.length; i += batchSize) {
        const batch = killsData.slice(i, i + batchSize);
        
        await errorHandler.withRetry(
          async () => {
            await this.prisma.killFact.createMany({
              data: batch,
              skipDuplicates: true,
            });

            logger.debug('Batch insert successful', {
              correlationId,
              batchIndex: Math.floor(i / batchSize) + 1,
              batchSize: batch.length,
              totalBatches: Math.ceil(killsData.length / batchSize),
            });
          },
          3,
          1000,
          {
            correlationId,
            operation: 'db.bulkInsertKills',
            metadata: {
              batchIndex: Math.floor(i / batchSize) + 1,
              batchSize: batch.length,
              totalRecords: killsData.length,
            },
          }
        );
      }

      logger.info('Bulk insert completed', {
        correlationId,
        totalRecords: killsData.length,
        batchCount: Math.ceil(killsData.length / batchSize),
      });
    } catch (error) {
      throw errorHandler.handleDatabaseError(
        error,
        'create',
        'kill_fact',
        undefined,
        {
          correlationId,
          metadata: {
            totalRecords: killsData.length,
            batchSize,
          },
        }
      );
    }
  }

  // Helper methods for error identification
  private isPrismaConstraintError(error: any): boolean {
    return error?.code === 'P2002';
  }

  private isPrismaNotFoundError(error: any): boolean {
    return error?.code === 'P2025';
  }

  private isPrismaTimeoutError(error: any): boolean {
    return error?.code === 'P1008';
  }

  private extractConstraintName(error: any): string {
    return error?.meta?.target || 'unknown_constraint';
  }
}

/**
 * Example: Enhanced database connection management
 */
export class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private prisma: PrismaClient | null = null;
  private isConnected = false;

  private constructor() {}

  static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }

  async connect(): Promise<PrismaClient> {
    if (this.prisma && this.isConnected) {
      return this.prisma;
    }

    const correlationId = errorHandler.createCorrelationId();

    try {
      this.prisma = new PrismaClient({
        log: [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ],
      });

      // Set up error event handlers
      this.prisma.$on('error', (event) => {
        const dbError = errorHandler.handleDatabaseError(
          new Error(event.message),
          'query',
          event.target || 'unknown',
          undefined,
          { correlationId }
        );

        logger.error('Database error event', dbError.toLogFormat());
      });

      // Test the connection
      await this.prisma.$connect();
      await this.prisma.$queryRaw`SELECT 1`;

      this.isConnected = true;

      logger.info('Database connected successfully', {
        correlationId,
        provider: 'postgresql',
      });

      return this.prisma;
    } catch (error) {
      throw DatabaseError.connectionFailed(
        { correlationId },
        error as Error
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
      this.isConnected = false;

      logger.info('Database disconnected');
    }
  }

  getPrismaClient(): PrismaClient {
    if (!this.prisma || !this.isConnected) {
      throw DatabaseError.connectionFailed();
    }
    return this.prisma;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.prisma || !this.isConnected) {
      return false;
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.warn('Database health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}