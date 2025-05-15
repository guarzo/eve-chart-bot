#!/usr/bin/env node

import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";

const program = new Command();
const prisma = new PrismaClient();

program
  .name("test-interaction-handler")
  .description("Test Discord interaction handler")
  .version("1.0.0");

async function testInteractionHandler() {
  try {
    // Get a test character
    const character = await prisma.character.findFirst({
      where: { isMain: true },
    });

    if (!character) {
      throw new Error("No test character found");
    }

    // Create a mock interaction
    const mockInteraction = {
      type: 2, // Application command
      data: {
        name: "test",
        options: [
          {
            name: "character",
            value: character.eveId,
          },
        ],
      },
      guild_id: "123456789",
      channel_id: "987654321",
      member: {
        user: {
          id: "123456789",
          username: "TestUser",
          discriminator: "1234",
        },
      },
    };

    logger.info("Created mock interaction:", mockInteraction);
    process.exit(0);
  } catch (error) {
    logger.error("Test failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

program.action(testInteractionHandler);

export default program;
