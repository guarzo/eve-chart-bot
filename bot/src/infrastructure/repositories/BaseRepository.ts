import { PrismaClient } from "@prisma/client";
import { ClassConstructor } from "class-transformer";
import { logger } from "../../lib/logger";
import prisma from "../persistence/client";
import { PrismaMapper } from "../mapper/PrismaMapper";
import { ensureBigInt } from "../../utils/conversion";

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
   * Execute a database query with error handling
   */
  protected async executeQuery<R>(queryFn: () => Promise<R>): Promise<R> {
    try {
      return await queryFn();
    } catch (error) {
      logger.error(`Error in ${this.modelName} repository:`, error);
      throw error;
    }
  }

  /**
   * Generic find by ID method
   */
  protected async findById<T>(
    id: string | number | bigint,
    EntityClass: ClassConstructor<T>,
    options: any = {}
  ): Promise<T | null> {
    return this.executeQuery(async () => {
      const normalizedId = ensureBigInt(id);
      const record = await (this.prisma as any)[this.modelName].findUnique({
        where: { id: normalizedId },
        ...options,
      });
      return record ? PrismaMapper.map(record, EntityClass) : null;
    });
  }

  /**
   * Generic find many method
   */
  protected async findMany<T>(
    EntityClass: ClassConstructor<T>,
    options: any = {}
  ): Promise<T[]> {
    return this.executeQuery(async () => {
      const records = await (this.prisma as any)[this.modelName].findMany(
        options
      );
      return PrismaMapper.mapArray(records, EntityClass);
    });
  }

  /**
   * Generic create method
   */
  protected async create<T>(
    data: any,
    EntityClass: ClassConstructor<T>
  ): Promise<T> {
    return this.executeQuery(async () => {
      const record = await (this.prisma as any)[this.modelName].create({
        data,
      });
      return PrismaMapper.map(record, EntityClass);
    });
  }

  /**
   * Generic upsert method
   */
  protected async upsert<T>(
    where: any,
    create: any,
    update: any,
    EntityClass: ClassConstructor<T>
  ): Promise<T> {
    return this.executeQuery(async () => {
      const record = await (this.prisma as any)[this.modelName].upsert({
        where,
        create,
        update,
      });
      return PrismaMapper.map(record, EntityClass);
    });
  }

  /**
   * Generic delete method
   */
  protected async delete(where: any): Promise<void> {
    return this.executeQuery(async () => {
      await (this.prisma as any)[this.modelName].delete({ where });
    });
  }

  /**
   * Generic count method
   */
  protected async count(where: any = {}): Promise<number> {
    return this.executeQuery(async () => {
      return await (this.prisma as any)[this.modelName].count({ where });
    });
  }

  /**
   * Generic find first method
   */
  protected async findFirst<T>(
    EntityClass: ClassConstructor<T>,
    options: any = {}
  ): Promise<T | null> {
    return this.executeQuery(async () => {
      const record = await (this.prisma as any)[this.modelName].findFirst(
        options
      );
      return record ? PrismaMapper.map(record, EntityClass) : null;
    });
  }

  /**
   * Generic update method
   */
  protected async update<T>(
    where: any,
    data: any,
    EntityClass: ClassConstructor<T>
  ): Promise<T> {
    return this.executeQuery(async () => {
      const record = await (this.prisma as any)[this.modelName].update({
        where,
        data,
      });
      return PrismaMapper.map(record, EntityClass);
    });
  }

  /**
   * Generic delete many method
   */
  protected async deleteMany(where: any = {}): Promise<{ count: number }> {
    return this.executeQuery(async () => {
      return await (this.prisma as any)[this.modelName].deleteMany({ where });
    });
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
