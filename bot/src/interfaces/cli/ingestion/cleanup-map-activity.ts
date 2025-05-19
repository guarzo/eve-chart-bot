import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

/**
 * Cleanup duplicate map activity records and normalize data
 * Using a much simpler approach to avoid DB errors
 */
async function cleanupMapActivity() {
  const prisma = new PrismaClient();

  try {
    logger.info("Starting simplified map activity cleanup process");

    // 1. Get total count before cleanup
    const initialCount = await prisma.mapActivity.count();
    logger.info(`Initial map activity count: ${initialCount}`);

    if (initialCount === 0) {
      logger.info("No map activity records to clean up");
      return;
    }

    // 2. Simple approach: Keep only one record per character per day
    // Get all character IDs first
    const characterResult = await prisma.$queryRaw`
      SELECT DISTINCT "characterId" FROM map_activities
    `;
    const characters = characterResult as Array<{ characterId: bigint }>;

    logger.info(`Found ${characters.length} characters with map activity`);

    // Track our progress
    let totalRemoved = 0;

    // Process each character
    for (const { characterId } of characters) {
      try {
        // Find all days with duplicate records
        logger.info(`Processing character ${characterId}`);

        // Direct SQL approach
        const result = await prisma.$executeRaw`
          WITH duplicates AS (
            SELECT 
              "characterId", 
              DATE("timestamp") as activity_date,
              COUNT(*) as record_count
            FROM map_activities
            WHERE "characterId" = ${characterId}
            GROUP BY "characterId", DATE("timestamp")
            HAVING COUNT(*) > 1
          )
          SELECT * FROM duplicates
        `;

        logger.info(
          `Character ${characterId} has ${result} dates with duplicates`
        );

        // Now delete duplicates, keeping only one record per day
        // This is a simpler approach that doesn't require complex joins
        const deletedCount = await prisma.$executeRaw`
          DELETE FROM map_activities 
          WHERE id IN (
            SELECT id FROM (
              SELECT 
                id,
                "characterId",
                "timestamp",
                ROW_NUMBER() OVER (PARTITION BY "characterId", DATE("timestamp") ORDER BY "timestamp") as rn
              FROM map_activities
              WHERE "characterId" = ${characterId}
            ) ranked
            WHERE rn > 1
          )
        `;

        logger.info(
          `Removed ${deletedCount} duplicate records for character ${characterId}`
        );
        totalRemoved += Number(deletedCount);
      } catch (error) {
        logger.error(`Error processing character ${characterId}:`, error);
      }
    }

    // Final report
    const finalCount = await prisma.mapActivity.count();
    logger.info(`Map activity cleanup complete:`);
    logger.info(`- Initial count: ${initialCount}`);
    logger.info(`- Records removed: ${totalRemoved}`);
    logger.info(`- Final count: ${finalCount}`);
    logger.info(
      `- Reduction: ${((totalRemoved / initialCount) * 100).toFixed(2)}%`
    );
  } catch (error) {
    logger.error("Error during map activity cleanup:", error);
    if (error instanceof Error) {
      logger.error(`Error message: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupMapActivity().catch((error) => {
  logger.error("Cleanup script failed:", error);
  if (error instanceof Error) {
    logger.error(`Error message: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
  }
  process.exit(1);
});
