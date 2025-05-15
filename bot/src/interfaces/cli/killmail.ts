#!/usr/bin/env node

import { Command } from "commander";
import fixSoloCommand from "./killmail/fix-solo";
import checkDetailsCommand from "./killmail/check-details";
import checkActualSoloCommand from "./killmail/check-actual-solo";
import addTestLossesCommand from "./killmail/add-test-losses";
import populateRelationsCommand from "./killmail/populate-relations";
import checkSoloCommand from "./killmail/check-solo";
import cleanupTestSoloCommand from "./killmail/cleanup-test-solo";
import populateTestSoloCommand from "./killmail/populate-test-solo";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger";

const program = new Command();
const prisma = new PrismaClient();

program
  .name("eve-chart-bot-killmail")
  .description("Killmail management commands")
  .version("1.0.0");

// Add the populate-relations command
program.addCommand(populateRelationsCommand);

// Add the check-details command
program.addCommand(checkDetailsCommand);

// Add the check-solo command
program.addCommand(checkSoloCommand);

// Add the fix-solo command
program.addCommand(fixSoloCommand);

// Add the check-actual-solo command
program.addCommand(checkActualSoloCommand);

// Add the cleanup-test-solo command
program.addCommand(cleanupTestSoloCommand);

// Add the populate-test-solo command
program.addCommand(populateTestSoloCommand);

// Add the add-test-losses command
program.addCommand(addTestLossesCommand);

// Use this instead of .parse() when used as a subcommand
export default program;
