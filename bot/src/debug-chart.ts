import { PrismaClient } from "@prisma/client";
import { logger } from "./lib/logger";

async function debugCharts() {
  const prisma = new PrismaClient();

  try {
    // 1. Get total count of kills in database
    const totalKills = await (prisma as any).kills_fact.count();
    console.log(`Total kills in database: ${totalKills}`);

    // 2. Get sample of recent kills to understand structure
    const sampleKills = await (prisma as any).kills_fact.findMany({
      take: 5,
      orderBy: { kill_time: "desc" },
    });
    console.log("Sample recent kills:", sampleKills);

    // 3. Check if character_id field matches our expectations
    const sampleKillIds = sampleKills.map((k: any) =>
      k.character_id.toString()
    );
    console.log("Character IDs in sample kills:", sampleKillIds);

    // 4. Check if these characters exist in our characters table
    const matchingCharacters = await prisma.character.findMany({
      where: {
        eveId: { in: sampleKillIds },
      },
    });
    console.log("Matching characters found:", matchingCharacters.length);
    console.log("Character details:", matchingCharacters);

    // 5. Get all main characters
    const mainCharacters = await prisma.character.findMany({
      where: { isMain: true },
    });
    console.log(`Found ${mainCharacters.length} main characters`);
    console.log(
      "Main character IDs:",
      mainCharacters.map((c) => c.eveId)
    );

    // 6. Try a more inclusive query approach
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Look back 30 days

    const allKillsInPeriod = await (prisma as any).kills_fact.count({
      where: {
        kill_time: { gte: startDate },
      },
    });
    console.log(`All kills in last 30 days: ${allKillsInPeriod}`);

    // 7. Check data format to see if the wrong types are being used
    const characterIds = mainCharacters.map((c) => BigInt(c.eveId));
    console.log("Character IDs as BigInt:", characterIds);

    // 8. Try the query used in chart service
    const killsQuery = await (prisma as any).kills_fact.findMany({
      where: {
        character_id: {
          in: characterIds,
        },
        kill_time: { gte: startDate },
      },
      orderBy: { kill_time: "asc" },
    });
    console.log(`Found ${killsQuery.length} kills using the chart query`);

    // Display some details about the matching kills
    console.log(
      "Matching kills character IDs:",
      killsQuery.map((k: any) => k.character_id.toString())
    );

    // 9. Check for type mismatch between Character.eveId and kills_fact.character_id
    console.log("\nAnalyzing type mismatches:");

    // Get all character IDs in the system
    const allCharacters = await prisma.character.findMany({
      select: { eveId: true },
    });
    const allCharacterIds = allCharacters.map((c) => c.eveId);
    console.log(
      `Total characters in characters table: ${allCharacterIds.length}`
    );

    // Get the first 20 kill records to examine
    const killSample = await (prisma as any).kills_fact.findMany({
      take: 20,
      select: { killmail_id: true, character_id: true },
      orderBy: { kill_time: "desc" },
    });

    // Check which kill character_ids match with the character.eveId
    const matchResults = killSample.map((kill: any) => {
      const characterIdString = kill.character_id.toString();
      const hasMatch = allCharacterIds.includes(characterIdString);
      return {
        killmail_id: kill.killmail_id.toString(),
        character_id: characterIdString,
        hasMatch,
      };
    });

    console.log("Kill sample match results:", matchResults);
    console.log(
      `Matches found: ${
        matchResults.filter((r: any) => r.hasMatch).length
      } out of ${matchResults.length}`
    );

    // 10. Check character types in the database
    const mainCharacterSample = mainCharacters.slice(0, 3);
    console.log("\nChecking main character data types:");
    for (const char of mainCharacterSample) {
      console.log(`Character ID ${char.eveId}:`);
      console.log(`- Type: ${typeof char.eveId}`);
      console.log(`- Value: ${char.eveId}`);

      // Try to find kills for this specific character
      const charKills = await (prisma as any).kills_fact.findMany({
        where: {
          character_id: BigInt(char.eveId),
        },
        take: 5,
      });

      console.log(`- Found ${charKills.length} kills with exact BigInt match`);

      // Check all other characters that have the same numeric ID
      const similarIdChars = await prisma.character.findMany({
        where: {
          eveId: { not: char.eveId },
        },
        select: { eveId: true, name: true },
      });

      const sameNumericIdChars = similarIdChars.filter(
        (c) => BigInt(c.eveId) === BigInt(char.eveId)
      );

      if (sameNumericIdChars.length > 0) {
        console.log(
          `- Characters with same numeric ID but different string ID:`,
          sameNumericIdChars
        );
      } else {
        console.log(`- No other characters have the same numeric ID`);
      }
    }
  } catch (error) {
    console.error("Error debugging charts:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugCharts().catch(console.error);
