#!/usr/bin/env node

import { Command } from "commander";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

// Load environment variables from .env file
config();

const program = new Command();
const prisma = new PrismaClient();

program
  .name("test-map-ingestion")
  .description("Test map activity ingestion")
  .version("1.0.0");

async function cleanup() {
  try {
    // Delete all test data
    await prisma.mapActivity.deleteMany();
    await prisma.character.deleteMany();
    await prisma.characterGroup.deleteMany();
    logger.info("Cleaned up test data");
  } catch (error) {
    logger.error("Error during cleanup:", error);
  }
}

async function simulateMapActivity() {
  try {
    // Get a test character
    const group = await prisma.characterGroup.findFirst({
      where: {
        mainCharacterId: { not: null },
      },
      include: {
        mainCharacter: true,
      },
    });

    const character = group?.mainCharacter;

    if (!character) {
      throw new Error("No test character found");
    }

    // Create mock map activities
    const mockActivities = [
      {
        characterId: BigInt(character.eveId),
        systemId: 30000142, // Jita
        signatures: 5,
        connections: 3,
        passages: 2,
        timestamp: new Date(),
        corporationId: Number(character.corporationId),
      },
      {
        characterId: BigInt(character.eveId),
        systemId: 30002187, // Amarr
        signatures: 3,
        connections: 2,
        passages: 1,
        timestamp: new Date(),
        corporationId: Number(character.corporationId),
      },
    ];

    // Insert the activities
    for (const activity of mockActivities) {
      await prisma.mapActivity.create({
        data: activity,
      });
    }

    logger.info("Created test map activities");
  } catch (error) {
    logger.error("Error creating test map activities:", error);
    throw error;
  }
}

export async function testMapIngestion() {
  try {
    // Clean up any existing test data
    await cleanup();

    // Create test map activities
    await simulateMapActivity();

    // Verify the data was created
    const activities = await prisma.mapActivity.findMany({
      orderBy: { timestamp: "desc" },
    });

    logger.info(`Created ${activities.length} test map activities`);
    activities.forEach((activity) => {
      logger.info(
        `Activity: ${activity.timestamp.toISOString()}, Signatures: ${
          activity.signatures
        }, Connections: ${activity.connections}, Passages: ${activity.passages}`
      );
    });

    process.exit(0);
  } catch (error) {
    logger.error("Test failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

program.action(testMapIngestion);

export default program;
