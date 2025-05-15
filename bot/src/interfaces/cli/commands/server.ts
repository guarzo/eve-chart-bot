import { Argv } from "yargs";
import { logger } from "../../../lib/logger";
import { startServer } from "../../rest";

export const command = "server";
export const desc = "Start the REST API server";

export const builder = (yargs: Argv) => {
  return yargs
    .option("port", {
      alias: "p",
      describe: "Port to listen on",
      type: "number",
      default: 3000,
    })
    .option("verbose", {
      alias: "v",
      describe: "Enable verbose logging",
      type: "boolean",
      default: false,
    })
    .example("$0 server", "Start the server on the default port (3000)")
    .example("$0 server -p 8080", "Start the server on port 8080");
};

type ServerArgs = {
  port: number;
  verbose: boolean;
};

export const handler = (argv: ServerArgs) => {
  try {
    // Set log level based on verbose flag
    if (argv.verbose) {
      logger.level = "debug";
    }

    logger.info(`Starting server on port ${argv.port}`);

    // Start the server
    startServer(argv.port);

    // The server will keep running until terminated
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Server failed to start"
    );
    process.exit(1);
  }
};
