import { Argv } from "yargs";
import { logger } from "../../../lib/logger";
import { prisma } from "../../../infrastructure/persistence/client";

export const command = "ingest";
export const desc = "Start killmail ingestion";

export const builder = (yargs: Argv) => {
  return yargs
    .option("mode", {
      alias: "m",
      describe: "Ingestion mode: realtime or backfill",
      choices: ["realtime", "backfill"],
      default: "realtime",
    })
    .option("character", {
      alias: "c",
      describe: "Character ID to backfill (only used in backfill mode)",
      type: "number",
    })
    .option("days", {
      alias: "d",
      describe: "Number of days to backfill (only used in backfill mode)",
      type: "number",
      default: 30,
    })
    .option("verbose", {
      alias: "v",
      describe: "Enable verbose logging",
      type: "boolean",
      default: false,
    })
    .example("$0 ingest", "Start real-time killmail ingestion")
    .example(
      "$0 ingest --mode backfill --character 12345 --days 14",
      "Backfill killmails for a character for the last 14 days"
    );
};

type IngestArgs = {
  mode: "realtime" | "backfill";
  character?: number;
  days: number;
  verbose: boolean;
};

export const handler = async (argv: IngestArgs) => {
  try {
    // Set log level based on verbose flag
    if (argv.verbose) {
      logger.level = "debug";
    }

    logger.info(`Starting killmail ingestion in ${argv.mode} mode`);

    if (argv.mode === "backfill") {
      if (!argv.character) {
        logger.error("Character ID is required for backfill mode");
        process.exit(1);
      }

      logger.info(
        `Backfilling killmails for character ${argv.character} for the last ${argv.days} days`
      );

      // TODO: Replace with unified IngestionService when implemented
      logger.info("Backfill mode not yet implemented in the new structure");
      logger.info("Run the legacy backfill script for now");
    } else {
      logger.info("Starting real-time killmail ingestion");

      // TODO: Replace with unified IngestionService when implemented
      logger.info("Realtime mode not yet implemented in the new structure");
      logger.info("Run the legacy redisq-ingest script for now");
    }

    logger.info("Ingestion completed");
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Ingestion failed"
    );
    process.exit(1);
  } finally {
    // Always disconnect from the database
    await prisma.$disconnect();
  }
};
