#!/usr/bin/env node

import { Command } from "commander";
import resetCommand from "./database/reset";
import migrateCommand from "./database/migrate";
import migrateMapActivityCommand from "./database/migrate-map-activity";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";

const program = new Command();
const prisma = new PrismaClient();

program
  .name("eve-chart-bot-database")
  .description("Database management commands")
  .version("1.0.0");

// Add the reset command
program.addCommand(resetCommand);

// Add the migrate command
program.addCommand(migrateCommand);

// Add the migrate-map-activity command
program.addCommand(migrateMapActivityCommand);

// Use this instead of .parse() when used as a subcommand
export default program;
