import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// Define source and target directories
const SRC_SCRIPTS_DIR = path.resolve(__dirname, "../src/scripts");
const CLI_DIR = path.resolve(__dirname, "../src/interfaces/cli");

// Define categories and their scripts
const CATEGORY_MAPPINGS: Record<string, string[]> = {
  character: [
    "check-character-group-assignments.ts",
    "cleanup-character-groups.ts",
    "prevent-empty-character-groups.ts",
    "create-default-groups.ts",
    "cleanup-empty-character-groups.ts",
    "clean-character-groups.ts",
    "fix-character-groups.ts",
    "debug-character-groups.ts",
    "merge-duplicate-groups.ts",
    "sync-characters.ts",
  ],
  database: ["verify-tables.ts", "test-bigint-serialization.ts"],
  killmail: [
    "backfill-kill-relations.ts",
    "verify-kill-data.ts",
    "fix-kill-relations.ts",
    "sync-kills.ts",
  ],
  discord: [
    "register-to-guild.ts",
    "restart-bot.ts",
    "test-interaction-handler.ts",
    "check-commands.ts",
    "register-commands.ts",
    "reset-commands.ts",
    "test-discord.ts",
    "register-test-commands.ts",
  ],
  ingestion: [
    "update-ingestion-service.ts",
    "start-ingestion.ts",
    "test-ingestion.ts",
    "test-map-ingestion.ts",
    "start-redisq.ts",
    "sync-map-activity.ts",
    "cleanup.ts",
  ],
};

// Mapping of script file names to CLI command names
const COMMAND_NAME_MAPPINGS: Record<string, string> = {
  "check-character-group-assignments.ts": "check-groups",
  "cleanup-character-groups.ts": "cleanup-groups",
  "prevent-empty-character-groups.ts": "prevent-empty-groups",
  "create-default-groups.ts": "create-default-groups",
  "cleanup-empty-character-groups.ts": "cleanup-empty-groups",
  "clean-character-groups.ts": "clean-groups",
  "fix-character-groups.ts": "fix-groups",
  "debug-character-groups.ts": "debug-groups",
  "merge-duplicate-groups.ts": "merge-duplicate-groups",
  "verify-tables.ts": "verify-tables",
  "test-bigint-serialization.ts": "test-bigint",
  "backfill-kill-relations.ts": "backfill-relations",
  "verify-kill-data.ts": "verify-data",
  "fix-kill-relations.ts": "fix-relations",
  "sync-kills.ts": "sync-kills",
  "register-to-guild.ts": "register-to-guild",
  "restart-bot.ts": "restart",
  "test-interaction-handler.ts": "test-interaction",
  "check-commands.ts": "check-commands",
  "register-commands.ts": "register-commands",
  "reset-commands.ts": "reset-commands",
  "test-discord.ts": "test",
  "register-test-commands.ts": "register-test-commands",
  "update-ingestion-service.ts": "update-service",
  "start-ingestion.ts": "start",
  "test-ingestion.ts": "test",
  "test-map-ingestion.ts": "test-map",
  "start-redisq.ts": "start-redisq",
  "sync-map-activity.ts": "sync-map",
  "cleanup.ts": "cleanup",
};

// Function to create the export function name based on the script file name
function getExportFunctionName(scriptFileName: string): string {
  // Remove the extension and convert to camelCase
  const baseName = path.basename(scriptFileName, ".ts");
  return baseName
    .split("-")
    .map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("");
}

// Function to convert a script file to a CLI module
async function convertScriptToCLIModule(
  category: string,
  scriptFileName: string
): Promise<void> {
  const scriptPath = path.join(SRC_SCRIPTS_DIR, scriptFileName);
  const categoryDir = path.join(CLI_DIR, category);
  const targetPath = path.join(categoryDir, scriptFileName);

  // Ensure the category directory exists
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
    console.log(`Created category directory: ${categoryDir}`);
  }

  // Check if the script file exists
  if (!fs.existsSync(scriptPath)) {
    console.log(`Script file not found: ${scriptPath}`);
    return;
  }

  // Read the original script content
  let content = fs.readFileSync(scriptPath, "utf8");

  // Extract the function name
  const exportFunctionName = getExportFunctionName(scriptFileName);

  // Modify import paths to account for new location
  content = content.replace(/from "(\.\.\/lib)/g, 'from "../../../lib');
  content = content.replace(/from "(\.\.\/utils)/g, 'from "../../../utils');
  content = content.replace(/from "(\.\.\/models)/g, 'from "../../../models');
  content = content.replace(
    /from "(\.\.\/services)/g,
    'from "../../../services'
  );

  // Transform the main function to an exported function
  content = content
    .replace(
      /async function main\(\)/,
      `export async function ${exportFunctionName}()`
    )
    .replace(/function main\(\)/, `export function ${exportFunctionName}()`);

  // Remove the main execution code
  content = content.replace(/main\(\)\s*\.then[\s\S]*?}\);/m, "");

  // Write to the target file
  fs.writeFileSync(targetPath, content);
  console.log(`Created CLI module: ${targetPath}`);

  // Remove the original script file
  fs.unlinkSync(scriptPath);
  console.log(`Removed original script: ${scriptPath}`);
}

// Function to update the category file with the new command
function updateCategoryFile(category: string, scriptFileName: string): void {
  const categoryFilePath = path.join(CLI_DIR, `${category}.ts`);
  const commandName =
    COMMAND_NAME_MAPPINGS[scriptFileName] || scriptFileName.replace(".ts", "");
  const exportFunctionName = getExportFunctionName(scriptFileName);
  const scriptBaseName = path.basename(scriptFileName, ".ts");

  // Check if the category file exists
  if (!fs.existsSync(categoryFilePath)) {
    // Create a new category file with the basic structure
    const categoryFileContent = `#!/usr/bin/env node

import { Command } from "commander";

const program = new Command();

program
  .name("eve-chart-bot-${category}")
  .description("EVE Online Chart Bot ${
    category.charAt(0).toUpperCase() + category.slice(1)
  } Commands")
  .version("1.0.0");

// ${commandName} command
program
  .command("${commandName}")
  .description("${getCommandDescription(scriptFileName)}")
  .action(async () => {
    const { ${exportFunctionName} } = await import(
      "./${category}/${scriptBaseName}"
    );
    await ${exportFunctionName}();
  });

program.parse(process.argv);
`;
    fs.writeFileSync(categoryFilePath, categoryFileContent);
    console.log(`Created new category file: ${categoryFilePath}`);
  } else {
    // Update existing category file
    let categoryContent = fs.readFileSync(categoryFilePath, "utf8");

    // Check if the command already exists
    if (categoryContent.includes(`command("${commandName}")`)) {
      console.log(
        `Command ${commandName} already exists in ${categoryFilePath}`
      );
      return;
    }

    // Add the new command before the program.parse line
    const newCommandBlock = `
// ${commandName} command
program
  .command("${commandName}")
  .description("${getCommandDescription(scriptFileName)}")
  .action(async () => {
    const { ${exportFunctionName} } = await import(
      "./${category}/${scriptBaseName}"
    );
    await ${exportFunctionName}();
  });
`;

    categoryContent = categoryContent.replace(
      /program\.parse\(process\.argv\);/,
      `${newCommandBlock}\nprogram.parse(process.argv);`
    );

    fs.writeFileSync(categoryFilePath, categoryContent);
    console.log(`Updated category file with new command: ${commandName}`);
  }
}

// Helper function to generate a command description
function getCommandDescription(scriptFileName: string): string {
  // Convert kebab-case to sentence case with proper capitalization
  return path
    .basename(scriptFileName, ".ts")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Main migration function
async function migrateScripts(): Promise<void> {
  try {
    console.log("Starting script migration to CLI...");

    let totalMigrated = 0;

    // Process each category
    for (const [category, scripts] of Object.entries(CATEGORY_MAPPINGS)) {
      console.log(`\nProcessing ${category} category...`);

      // Process each script in the category
      for (const scriptFileName of scripts) {
        try {
          await convertScriptToCLIModule(category, scriptFileName);
          updateCategoryFile(category, scriptFileName);
          totalMigrated++;
        } catch (error) {
          console.error(`Error migrating ${scriptFileName}:`, error);
        }
      }
    }

    console.log(
      `\nMigration complete! Migrated ${totalMigrated} scripts to CLI interface.`
    );
    console.log(
      "Remember to check the CLI files for any necessary adjustments."
    );
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

// Run the migration
migrateScripts();
