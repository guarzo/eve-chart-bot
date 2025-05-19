#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../lib/logger";
import axios from "axios";
import { subDays } from "date-fns";

async function checkKillIngestion() {
  const prisma = new PrismaClient();

  try {
    // Get the character ID from command line
    const characterId = process.argv[2] || "2117608364"; // Default to Shivon
    const days = parseInt(process.argv[3] || "7");

    logger.info(
      `Checking kill ingestion for character ID: ${characterId} (last ${days} days)`
    );

    const endDate = new Date();
    const startDate = subDays(endDate, days);

    // First check what's in our database
    const dbKills = await prisma.killFact.findMany({
      where: {
        OR: [
          { character_id: BigInt(characterId) },
          {
            attackers: {
              some: {
                character_id: BigInt(characterId),
              },
            },
          },
        ],
        kill_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        killmail_id: true,
        kill_time: true,
        character_id: true,
      },
      orderBy: { kill_time: "desc" },
    });

    logger.info(
      `Found ${dbKills.length} kills in database for character ${characterId}`
    );
    if (dbKills.length > 0) {
      logger.info(
        `Most recent kill in database: ${dbKills[0].killmail_id} at ${dbKills[0].kill_time}`
      );
    }

    // Now check zKillboard API directly
    logger.info(`Checking zKillboard API for character ${characterId}`);

    try {
      const responses = await Promise.all([
        // Try multiple endpoints to see which ones work
        axios
          .get(
            `https://zkillboard.com/api/kills/characterID/${characterId}/pastSeconds/${
              days * 24 * 60 * 60
            }/`,
            {
              headers: { "User-Agent": "EVE Charts Bot" },
            }
          )
          .catch((e) => ({ status: e.response?.status || 500, data: [] })),
        axios
          .get(`https://zkillboard.com/api/characterID/${characterId}/`, {
            headers: { "User-Agent": "EVE Charts Bot" },
          })
          .catch((e) => ({ status: e.response?.status || 500, data: [] })),
      ]);

      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        if (response.status === 200) {
          const zkillData = response.data || [];
          logger.info(
            `API endpoint ${i + 1} returned ${zkillData.length} kills`
          );

          if (zkillData.length > 0) {
            // Log the first few kills
            zkillData.slice(0, 3).forEach((kill: any) => {
              logger.info(
                `Kill ID: ${kill.killmail_id}, Time: ${kill.killmail_time}`
              );
            });

            // Compare with what's in our DB
            const zkillIds = new Set(
              zkillData.map((k: any) => k.killmail_id.toString())
            );
            const dbKillIds = new Set(
              dbKills.map((k) => k.killmail_id.toString())
            );

            const missingKills = [...zkillIds].filter(
              (id) => !dbKillIds.has(id)
            );
            logger.info(
              `${missingKills.length} kills from zKillboard are missing in our database`
            );

            if (missingKills.length > 0) {
              logger.info(
                `First 5 missing kill IDs: ${missingKills
                  .slice(0, 5)
                  .join(", ")}`
              );
            }
          }
        } else {
          logger.warn(
            `API endpoint ${i + 1} returned status ${response.status}`
          );
        }
      }
    } catch (error) {
      logger.error(`Error fetching from zKillboard: ${error}`);
    }

    // Check direct RedisQ access
    logger.info(`Checking RedisQ API...`);
    try {
      const redisqResponse = await axios.get(
        "https://redisq.zkillboard.com/listen.php",
        {
          headers: { "User-Agent": "EVE Charts Bot" },
        }
      );

      if (redisqResponse.data && redisqResponse.data.package) {
        logger.info(
          `RedisQ returned killmail: ${redisqResponse.data.package.killID}`
        );
      } else {
        logger.info(
          `RedisQ returned no killmail package, response: ${JSON.stringify(
            redisqResponse.data
          )}`
        );
      }
    } catch (error) {
      logger.error(`Error fetching from RedisQ: ${error}`);
    }

    // Check the most recent killmail in the database
    const latestKill = await prisma.killFact.findFirst({
      orderBy: {
        kill_time: "desc",
      },
      select: {
        killmail_id: true,
        kill_time: true,
        character_id: true,
      },
    });

    if (latestKill) {
      logger.info(
        `Latest kill in entire database: ID ${latestKill.killmail_id} at ${latestKill.kill_time}`
      );
    } else {
      logger.warn(`No kills found in the database at all!`);
    }
  } catch (error) {
    logger.error(`Error in check-kill-ingestion: ${error}`);
  } finally {
    await prisma.$disconnect();
  }
}

checkKillIngestion().catch((error) => {
  logger.error(`Unhandled exception: ${error}`);
  process.exit(1);
});
