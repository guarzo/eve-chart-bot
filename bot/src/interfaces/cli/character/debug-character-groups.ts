import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { logger } from "../../../lib/logger";

// Load environment variables
config();

const prisma = new PrismaClient();

/**
 * Debug character groups in the database
 */
async function debugCharacterGroups() {
  try {
    logger.info("Debugging character groups...");

    // Check if Prisma can connect to the database
    await prisma.$connect();
    logger.info("Successfully connected to the database");

    // Check database schema
    logger.info("Checking database schema");
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    logger.info(`Tables in database:`, tables);

    // Check character_groups table structure
    try {
      logger.info("Checking character_groups table structure");
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'character_groups' 
        ORDER BY ordinal_position;
      `;
      logger.info(`Columns in character_groups:`, columns);

      // Check if there are any records in the character_groups table
      const count = await prisma.$queryRaw`
        SELECT COUNT(*) FROM character_groups;
      `;
      logger.info(`Number of records in character_groups:`, count);

      // Try to get a sample record
      const sampleRecord = await prisma.$queryRaw`
        SELECT * FROM character_groups LIMIT 1;
      `;
      logger.info(`Sample record from character_groups:`, sampleRecord);
    } catch (error) {
      logger.error("Error querying character_groups table:", error);
    }

    // Try using Prisma's generated methods
    try {
      logger.info("Trying to use Prisma's characterGroup model");
      const groups = await prisma.characterGroup.findMany();
      logger.info(`Found ${groups.length} character groups using Prisma model`);

      if (groups.length > 0) {
        logger.info(`First character group:`, {
          id: groups[0].id,
          slug: groups[0].slug,
          mainCharacterId: groups[0].mainCharacterId,
        });

        // Try to load characters relationship
        const groupWithCharacters = await prisma.characterGroup.findUnique({
          where: { id: groups[0].id },
          include: { characters: true },
        });

        if (groupWithCharacters?.characters) {
          logger.info(
            `First group has ${groupWithCharacters.characters.length} characters`
          );
        } else {
          logger.warn("Failed to load characters relationship");
        }
      }
    } catch (error) {
      logger.error("Error using Prisma characterGroup model:", error);
    }

    // Check if there's a mismatch between database and Prisma schema
    try {
      // Try direct query to check relationships
      const groupsWithCharacters = await prisma.$queryRaw`
        SELECT cg.id, cg.slug, COUNT(c.eve_id) as character_count
        FROM character_groups cg
        LEFT JOIN characters c ON c.character_group_id = cg.id
        GROUP BY cg.id, cg.slug
        ORDER BY cg.id;
      `;
      logger.info(
        "Character groups with character counts:",
        groupsWithCharacters
      );
    } catch (error) {
      logger.error("Error querying group-character relationship:", error);
    }
  } catch (error) {
    logger.error("Error debugging character groups:", error);
  } finally {
    await prisma.$disconnect();
    logger.info("Debug complete");
  }
}

// Run the function
debugCharacterGroups().catch((error) => {
  logger.error("Script failed:", error);
  process.exit(1);
});
