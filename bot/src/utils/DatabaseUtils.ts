import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger";

/**
 * Utility functions for database operations
 */
export class DatabaseUtils {
  /**
   * Check if a table exists in the database, properly handling case sensitivity
   *
   * @param prisma PrismaClient instance
   * @param modelName Prisma model name (e.g., "MapActivity")
   * @returns Promise<boolean> indicating if the table exists
   */
  static async tableExists(
    prisma: PrismaClient,
    modelName: string
  ): Promise<boolean> {
    try {
      // Get the table name first, either from our mapping or fall back to model name
      const tableName = this.getTableNameFromMapping(modelName);

      if (!tableName) {
        logger.warn(`Could not determine table name for model ${modelName}`);
        return false;
      }

      // Check if the table exists in the database
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        );
      `;

      const exists = (result as any[])[0]?.exists || false;

      if (!exists) {
        logger.warn(`Table ${tableName} does not exist in the database`);
      } else {
        logger.info(`Table ${tableName} exists in the database`);
      }

      return exists;
    } catch (error) {
      logger.error(`Error checking if table ${modelName} exists:`, error);
      return false;
    }
  }

  /**
   * Get the actual database table name for a Prisma model
   *
   * @param modelName Prisma model name
   * @returns The database table name or null if not found
   */
  static getTableName(modelName: string): string | null {
    return this.getTableNameFromMapping(modelName);
  }

  /**
   * Get table name from our known model-to-table mappings
   * This is a more reliable approach than trying to access Prisma's internal metadata
   */
  private static getTableNameFromMapping(modelName: string): string | null {
    // Map of Prisma model names to actual database table names
    const modelToTableMap: Record<string, string> = {
      MapActivity: "map_activities",
      Character: "characters",
      CharacterGroup: "character_groups",
      KillFact: "KillFact",
      LossFact: "LossFact",
      KillAttacker: "KillAttacker",
      KillVictim: "KillVictim",
      IngestionCheckpoint: "ingestion_checkpoints",
    };

    const tableName = modelToTableMap[modelName];

    if (!tableName) {
      logger.warn(`Model ${modelName} not found in table mapping`);
      return null;
    }

    return tableName;
  }
}
