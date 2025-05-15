#!/usr/bin/env node

import { Command } from "commander";
import databaseProgram from "./database";
import killmailProgram from "./killmail";

const program = new Command();

program
  .name("eve-chart-bot")
  .description("EVE Online Chart Bot CLI")
  .version("1.0.0");

// Add subcommands
program.addCommand(databaseProgram);
program.addCommand(killmailProgram);

// Use this instead of .parse() when used as a subcommand
export default program;
