import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";
import { DatabaseUtils } from "../../utils/DatabaseUtils";
import prisma from "../persistence/client";

/**
 * Base repository class that all specific repositories will extend.
 * Provides common functionality and access to the database.
 */
export abstract class BaseRepository {
  protected prisma: PrismaClient;
  protected modelName: string;
  protected dbTableName: string | null;

  constructor(modelName: string) {
    this.prisma = prisma;
    this.modelName = modelName;
    this.dbTableName = null; // Table name resolution is not needed with Prisma client
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
   * Check if the table for this repository exists in the database
   */
  protected async tableExists(): Promise<boolean> {
    if (!this.dbTableName) {
      logger.warn(
        `Cannot check if table exists because dbTableName is not set for ${this.modelName}`
      );
      return false;
    }

    return DatabaseUtils.tableExists(this.prisma, this.dbTableName);
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
