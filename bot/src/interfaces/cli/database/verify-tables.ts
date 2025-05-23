import { logger } from "../../../lib/logger";
import { DatabaseUtils } from "../../../utils/DatabaseUtils";
import { RepositoryManager } from "../../../infrastructure/repositories/RepositoryManager";

/**
 * Script to verify database tables and their mappings
 */
async function verifyDatabaseTables() {
  const repositoryManager = new RepositoryManager();
  const characterRepo = repositoryManager.getCharacterRepository();

  try {
    logger.info("Starting database table verification...");

    // Connect to the database
    await characterRepo.prisma.$connect();
    logger.info("Connected to database successfully");

    // Get a list of all tables in the database
    const tables = await characterRepo.executeQuery(async () => {
      return characterRepo.prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;
    });

    logger.info("Tables in database:");
    for (const table of tables as any[]) {
      logger.info(`- ${table.table_name}`);
    }

    // Check specific Prisma models
    const modelsToCheck = [
      "MapActivity",
      "Character",
      "CharacterGroup",
      "KillFact",
      "LossFact",
    ];

    logger.info("\nChecking Prisma models to table mappings:");

    for (const modelName of modelsToCheck) {
      const tableName = DatabaseUtils.getTableName(modelName);
      const exists = await DatabaseUtils.tableExists(modelName);

      logger.info(`Model: ${modelName}`);
      logger.info(`  - Maps to table: ${tableName || "Unknown"}`);
      logger.info(`  - Table exists: ${exists ? "Yes" : "No"}`);

      // If table exists, get row count
      if (exists && tableName) {
        try {
          // Fixed query using string interpolation for dynamic table names
          // Using $executeRawUnsafe because we know the tableName is safe (it comes from our mapping)
          const query = `SELECT COUNT(*) as count FROM "${tableName}";`;
          const countResult = await characterRepo.executeQuery(async () => {
            return characterRepo.prisma.$executeRawUnsafe(query);
          });
          logger.info(`  - Row count: ${countResult}`);
        } catch (error) {
          logger.error(`  - Error getting row count: ${error}`);
        }
      }
    }

    logger.info("\nDatabase verification complete");
  } catch (error) {
    logger.error("Error verifying database tables:", error);
  } finally {
    await characterRepo.disconnect();
  }
}

// Run the script if directly executed
if (require.main === module) {
  verifyDatabaseTables()
    .then(() => {
      logger.info("Verification script completed");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Verification script failed:", error);
      process.exit(1);
    });
}

export { verifyDatabaseTables };
