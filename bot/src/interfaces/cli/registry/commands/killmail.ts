import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../../../lib/logger";

const prisma = new PrismaClient();

export function registerKillmailCommands(program: Command) {
  const killProgram = program
    .command("killmail")
    .description("Manage killmails");

  // List killmails command
  killProgram
    .command("list")
    .description("List all killmails")
    .option("-c, --character <id>", "Filter by character ID")
    .option("-s, --system <id>", "Filter by system ID")
    .action(async (options) => {
      try {
        const where = {
          ...(options.character && {
            characters: {
              some: {
                characterId: options.character,
              },
            },
          }),
          ...(options.system && {
            systemId: parseInt(options.system),
          }),
        };

        const killmails = await prisma.killFact.findMany({
          where,
          include: {
            characters: {
              include: {
                character: true,
              },
            },
            victims: true,
            attackers: true,
          },
        });

        logger.info(`Found ${killmails.length} killmails:`);
        for (const kill of killmails) {
          logger.info(`- Killmail ID: ${kill.killmail_id}`);
          logger.info(`  Time: ${kill.kill_time}`);
          logger.info(`  System: ${kill.system_id}`);
          logger.info(
            `  Characters: ${kill.characters
              .map((c) => c.character.name)
              .join(", ")}`
          );
        }
      } catch (error) {
        logger.error("Error listing killmails:", error);
        process.exit(1);
      } finally {
        await prisma.$disconnect();
      }
    });

  // Get killmail command
  killProgram
    .command("get <id>")
    .description("Get killmail details")
    .action(async (id) => {
      try {
        const killmail = await prisma.killFact.findUnique({
          where: { killmail_id: BigInt(id) },
          include: {
            characters: {
              include: {
                character: true,
              },
            },
            victims: true,
            attackers: true,
          },
        });

        if (!killmail) {
          logger.error(`Killmail with ID ${id} not found`);
          process.exit(1);
        }

        logger.info("Killmail details:");
        logger.info(`- ID: ${killmail.killmail_id}`);
        logger.info(`- Time: ${killmail.kill_time}`);
        logger.info(`- System: ${killmail.system_id}`);
        logger.info(`- Value: ${killmail.total_value}`);
        logger.info(`- Points: ${killmail.points}`);
        logger.info(`- NPC: ${killmail.npc}`);
        logger.info(`- Solo: ${killmail.solo}`);
        logger.info(`- AWOX: ${killmail.awox}`);

        logger.info("\nCharacters involved:");
        for (const char of killmail.characters) {
          logger.info(`- ${char.character.name} (${char.role})`);
        }

        logger.info("\nVictim:");
        for (const victim of killmail.victims) {
          logger.info(`- Ship: ${victim.ship_type_id}`);
          logger.info(`  Damage taken: ${victim.damage_taken}`);
        }

        logger.info("\nAttackers:");
        for (const attacker of killmail.attackers) {
          logger.info(`- Ship: ${attacker.ship_type_id}`);
          logger.info(`  Damage done: ${attacker.damage_done}`);
          logger.info(`  Final blow: ${attacker.final_blow}`);
        }
      } catch (error) {
        logger.error("Error getting killmail:", error);
        process.exit(1);
      } finally {
        await prisma.$disconnect();
      }
    });
}
