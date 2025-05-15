#!/usr/bin/env node

import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";

const program = new Command();
const prisma = new PrismaClient();

program
  .name("eve-chart-bot-character-remove")
  .description("Remove a character by its EVE ID")
  .argument("<characterId>", "The EVE ID of the character to remove")
  .action(async (characterId: string) => {
    try {
      const { removeCharacter } = await import("./character/remove-character");
      await removeCharacter(characterId);
    } catch (error) {
      logger.error("Failed to remove character:", error);
    } finally {
      await prisma.$disconnect();
    }
  });

program.parse(process.argv);
