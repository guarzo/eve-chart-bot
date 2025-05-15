#!/usr/bin/env node

import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { logger } from "../../../lib/logger";

// Load environment variables
config();

async function addTestLosses(characterCount: number) {
  const prisma = new PrismaClient();

  try {
    console.log("Starting test loss data creation...");

    // Get characters from the database
    const characters = await prisma.character.findMany({
      take: characterCount, // Limit to specified number of characters
    });

    if (characters.length === 0) {
      console.log("No characters found in the database.");
      return;
    }

    console.log(
      `Found ${characters.length} characters to create loss data for.`
    );

    // Delete existing test losses
    const deleteResult = await prisma.lossFact.deleteMany({
      where: {
        killmail_id: {
          gte: BigInt(90000000000),
        },
      },
    });

    console.log(`Deleted ${deleteResult.count} existing test loss records.`);

    // Create random loss data for each character
    const lossRecords = [];

    for (const character of characters) {
      const characterId = BigInt(character.eveId);
      const lossCount = Math.floor(Math.random() * 10) + 1; // 1-10 losses per character

      for (let i = 0; i < lossCount; i++) {
        const killmailId =
          BigInt(90000000000) + BigInt(Math.floor(Math.random() * 1000000));
        const daysAgo = Math.floor(Math.random() * 30); // Between 0-30 days ago
        const killTime = new Date();
        killTime.setDate(killTime.getDate() - daysAgo);

        const shipTypeId = 20000 + Math.floor(Math.random() * 1000); // Random ship type
        const systemId = 30000000 + Math.floor(Math.random() * 2000); // Random system
        const totalValue = BigInt(
          Math.floor(Math.random() * 100000000) + 10000000
        ); // Random value between 10M and 110M
        const attackerCount = Math.floor(Math.random() * 10) + 1; // 1-10 attackers

        lossRecords.push({
          killmail_id: killmailId,
          character_id: characterId,
          kill_time: killTime,
          ship_type_id: shipTypeId,
          system_id: systemId,
          total_value: totalValue,
          attacker_count: attackerCount,
          labels: ["test-data"],
        });
      }
    }

    // Insert all loss records
    const createResult = await prisma.lossFact.createMany({
      data: lossRecords,
      skipDuplicates: true,
    });

    console.log(
      `Successfully created ${createResult.count} test loss records.`
    );
  } catch (error) {
    console.error("Error creating test loss data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

const program = new Command("add-test-losses")
  .description("Add test loss data to the database for development purposes")
  .option(
    "-c, --count <number>",
    "Number of characters to create losses for",
    "10"
  )
  .action(async (options) => {
    const characterCount = parseInt(options.count, 10);

    if (isNaN(characterCount) || characterCount <= 0) {
      console.error("Error: character count must be a positive number");
      return;
    }

    console.log(
      `Creating test losses for up to ${characterCount} characters...`
    );
    await addTestLosses(characterCount);
    console.log("Test data creation complete!");
  });

export default program;
