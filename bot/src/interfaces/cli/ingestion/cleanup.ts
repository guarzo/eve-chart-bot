import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

const prisma = new PrismaClient();

async function cleanup() {
  try {
    // Delete all test data
    await prisma.mapActivity.deleteMany();
    await prisma.killFact.deleteMany();
    await prisma.character.deleteMany();
    await prisma.characterGroup.deleteMany();
    await prisma.ingestionCheckpoint.deleteMany();
    logger.info("Cleaned up all test data");
  } catch (error) {
    logger.error("Error during cleanup:", error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
