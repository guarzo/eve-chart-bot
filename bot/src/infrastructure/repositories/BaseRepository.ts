import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";
import prisma from "../persistence/client";

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
      // Execute query directly
      const result = await queryFn();
      return result;
    } catch (error) {
      logger.error(`Error in ${this.modelName} repository:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
