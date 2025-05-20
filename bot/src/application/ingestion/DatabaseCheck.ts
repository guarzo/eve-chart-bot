import { logger } from "../../lib/logger";
import { DatabaseUtils } from "../../utils/DatabaseUtils";

/**
 * Utility to check if required database tables exist and create them if needed
 */
export async function ensureDatabaseTablesExist(): Promise<void> {
  try {
    logger.info("Checking database schema...");

    // Check for KillFact table
    const killFactExists = await DatabaseUtils.tableExists("KillFact");
    if (killFactExists) {
      logger.info("KillFact table exists");
    } else {
      logger.warn(
        "KillFact table doesn't exist or is not accessible, will be created automatically"
      );
    }

    // Check for LossFact table
    const lossFactExists = await DatabaseUtils.tableExists("LossFact");
    if (lossFactExists) {
      logger.info("LossFact table exists");
    } else {
      logger.warn(
        "LossFact table doesn't exist or is not accessible, will be created automatically"
      );
    }

    // Check for MapActivity table - using the new utility that handles the mapping correctly
    const mapActivityExists = await DatabaseUtils.tableExists("MapActivity");
    if (mapActivityExists) {
      logger.info("MapActivity table exists");
    } else {
      logger.warn(
        "MapActivity table doesn't exist or is not accessible, will be created automatically"
      );
    }

    logger.info("Database schema check completed");
  } catch (error) {
    logger.error(`Error checking database schema: ${error}`);
  }
}
