#!/usr/bin/env node

import { Command } from "commander";
import { logger } from "../../../lib/logger";

// Import command modules
import { registerDatabaseCommands } from "./commands/database";
import { registerCharacterCommands } from "./commands/character";
import { registerKillmailCommands } from "./commands/killmail";
import { registerDiscordCommands } from "./commands/discord";
import { registerDiagnosticCommands } from "./commands/diagnostic";

// Create the main program
const program = new Command();

program
  .name("eve-chart-bot")
  .description("EVE Online Chart Bot CLI")
  .version("1.0.0")
  .option("-v, --verbose", "Enable verbose logging");

// Register all command groups
registerDatabaseCommands(program);
registerCharacterCommands(program);
registerKillmailCommands(program);
registerDiscordCommands(program);
registerDiagnosticCommands(program);

// Add global error handler
program.configureOutput({
  writeOut: (str) => process.stdout.write(str),
  writeErr: (str) => process.stderr.write(str),
  getOutHelpWidth: () => process.stdout.columns || 80,
  getErrHelpWidth: () => process.stderr.columns || 80,
});

// Parse command line arguments
try {
  program.parse(process.argv);
} catch (error) {
  logger.error("Error executing command:", error);
  process.exit(1);
}
