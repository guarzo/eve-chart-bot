import { PrismaClient } from '@prisma/client';
import { ClassConstructor } from 'class-transformer';
import { logger } from '../../lib/logger';
import prisma from '../persistence/client';
import { PrismaMapper } from '../mapper/PrismaMapper';
import { ensureBigInt } from '../../shared/utilities/conversion';
import { errorHandler } from '../../shared/errors';

/**
 * Base repository class that all specific repositories will extend.
 * Provides common functionality and access to the database.
 */
export abstract class BaseRepository {
  protected prisma: PrismaClient;
  protected modelName: string;

  constructor(modelName: string) {
    this.prisma = prisma;
    this.modelName = modelName;
  }

  /**
   * Execute a database query with error handling and retry logic
   */
  protected async executeQuery<R>(queryFn: () => Promise<R>, operation?: string, correlationId?: string): Promise<R> {
    const actualCorrelationId = correlationId || errorHandler.createCorrelationId();
    const actualOperation = operation || 'db.query';

    try {
      const result = await errorHandler.withRetry(queryFn, 3, 1000, {
        correlationId: actualCorrelationId,
        operation: `${this.modelName}.${actualOperation}`,
      });

      logger.debug('Database query executed successfully', {
        correlationId: actualCorrelationId,
        modelName: this.modelName,
        operation: actualOperation,
      });

      return result;
    } catch (error) {
      throw errorHandler.handleDatabaseError(error, 'query', this.modelName.toLowerCase(), undefined, undefined);
    }
  }

  /**
   * Generic find by ID method
   * @param model Prisma model name (e.g., 'character', 'killFact')
   * @param id The ID to search for
   * @param EntityClass The domain entity class constructor
   * @param options Additional query options (include, select, etc.)
   * @returns Domain entity instance or null
   */
  protected async findById<T>(
    model: string,
    id: any,
    EntityClass: ClassConstructor<T>,
    options: any = {}
  ): Promise<T | null> {
    return this.executeQuery(async () => {
      // Convert string/number IDs to BigInt if needed
      const normalizedId = typeof id === 'string' || typeof id === 'number' ? ensureBigInt(id) : id;

      const record = await (this.prisma as any)[model].findUnique({
        where: {
          id: normalizedId,
          // Also try common ID field patterns
          ...(model === 'character' && { eveId: normalizedId }),
          ...(model === 'killFact' && { killmailId: normalizedId }),
        },
        ...options,
      });

      return record ? PrismaMapper.map(record, EntityClass) : null;
    });
  }

  /**
   * Generic find many method
   * @param model Prisma model name
   * @param EntityClass The domain entity class constructor
   * @param options Query options (where, include, orderBy, etc.)
   * @returns Array of domain entity instances
   */
  protected async findMany<T>(model: string, EntityClass: ClassConstructor<T>, options: any = {}): Promise<T[]> {
    return this.executeQuery(async () => {
      const records = await (this.prisma as any)[model].findMany(options);
      return PrismaMapper.mapArray(records, EntityClass);
    });
  }

  /**
   * Generic create method
   * @param model Prisma model name
   * @param data Data to create
   * @param EntityClass The domain entity class constructor
   * @returns Created domain entity instance
   */
  protected async create<T>(model: string, data: any, EntityClass: ClassConstructor<T>): Promise<T> {
    return this.executeQuery(async () => {
      const record = await (this.prisma as any)[model].create({ data });
      return PrismaMapper.map(record, EntityClass);
    });
  }

  /**
   * Generic upsert method
   * @param model Prisma model name
   * @param where Where clause for finding existing record
   * @param create Data for creating new record
   * @param update Data for updating existing record
   * @param EntityClass The domain entity class constructor
   * @returns Upserted domain entity instance
   */
  protected async upsert<T>(
    model: string,
    where: any,
    create: any,
    update: any,
    EntityClass: ClassConstructor<T>
  ): Promise<T> {
    return this.executeQuery(async () => {
      const record = await (this.prisma as any)[model].upsert({
        where,
        create,
        update,
      });
      return PrismaMapper.map(record, EntityClass);
    });
  }

  /**
   * Generic delete method
   * @param model Prisma model name
   * @param where Where clause for deletion
   */
  protected async delete(model: string, where: any): Promise<void> {
    return this.executeQuery(async () => {
      await (this.prisma as any)[model].delete({ where });
    });
  }

  /**
   * Generic count method
   * @param model Prisma model name
   * @param where Optional where clause
   * @returns Count of records
   */
  protected async count(model: string, where: any = {}): Promise<number> {
    return this.executeQuery(async () => {
      return await (this.prisma as any)[model].count({ where });
    });
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
