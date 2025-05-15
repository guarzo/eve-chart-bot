import { Argv } from "yargs";
import fs from "fs";
import path from "path";
import { logger } from "../../../lib/logger";
import { prisma } from "../../../infrastructure/persistence/client";
import { ChartService } from "../../../application/chart/ChartService";
import { ChartRenderer } from "../../../application/chart/ChartRenderer";

export const command = "chart";
export const desc = "Generate EVE Online charts";

export const builder = (yargs: Argv) => {
  return yargs
    .option("type", {
      alias: "t",
      describe: "Type of chart to generate",
      choices: ["ship-usage", "kills-by-system", "damage-dealt"],
      default: "ship-usage",
    })
    .option("character", {
      alias: "c",
      describe: "Character ID to generate chart for",
      type: "string",
    })
    .option("group", {
      alias: "g",
      describe: "Group ID to generate chart for",
      type: "string",
    })
    .option("days", {
      alias: "d",
      describe: "Number of days of data to include",
      type: "number",
      default: 30,
    })
    .option("output", {
      alias: "o",
      describe: "Output file path",
      type: "string",
      default: "./chart.png",
    })
    .option("format", {
      alias: "f",
      describe: "Output format",
      choices: ["png", "html"],
      default: "png",
    })
    .option("width", {
      alias: "w",
      describe: "Width of the chart in pixels",
      type: "number",
      default: 800,
    })
    .option("height", {
      alias: "h",
      describe: "Height of the chart in pixels",
      type: "number",
      default: 600,
    })
    .option("light", {
      alias: "l",
      describe: "Use light mode instead of dark mode",
      type: "boolean",
      default: false,
    })
    .option("title", {
      describe: "Chart title",
      type: "string",
    })
    .option("no-legend", {
      describe: "Hide the chart legend",
      type: "boolean",
      default: false,
    })
    .option("verbose", {
      alias: "v",
      describe: "Enable verbose logging",
      type: "boolean",
      default: false,
    })
    .example(
      "$0 chart -c 12345 -o ship-usage.png",
      "Generate ship usage chart for character 12345"
    )
    .example(
      "$0 chart -g group-id -t kills-by-system -d 14",
      "Generate system kills chart for a group over 14 days"
    )
    .example(
      "$0 chart -c 12345 -f html -o stats.html",
      "Generate HTML chart for a character"
    )
    .demandOption(
      ["character", "group"],
      "Either character or group ID must be provided"
    );
};

type ChartArgs = {
  type: "ship-usage" | "kills-by-system" | "damage-dealt";
  character?: string;
  group?: string;
  days: number;
  output: string;
  format: "png" | "html";
  width: number;
  height: number;
  light: boolean;
  title?: string;
  noLegend: boolean;
  verbose: boolean;
};

export const handler = async (argv: ChartArgs) => {
  try {
    // Set log level based on verbose flag
    if (argv.verbose) {
      logger.level = "debug";
    }

    if (!argv.character && !argv.group) {
      logger.error("Either character or group ID must be provided");
      process.exit(1);
    }

    logger.info(
      `Generating ${argv.type} chart for ${
        argv.character ? "character " + argv.character : "group " + argv.group
      }`
    );

    // Initialize chart service
    const chartService = new ChartService();

    // Generate chart data based on type
    let chartData;
    if (argv.type === "ship-usage") {
      chartData = await chartService.generateShipUsageChart(
        argv.character,
        argv.group,
        argv.days
      );
    } else {
      logger.error(`Chart type '${argv.type}' not yet implemented`);
      process.exit(1);
    }

    if (!chartData) {
      logger.error("Failed to generate chart data");
      process.exit(1);
    }

    // Prepare output directory
    const outputDir = path.dirname(argv.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Render chart based on format
    if (argv.format === "png") {
      const chartBuffer = await ChartRenderer.renderPNG(chartData, {
        width: argv.width,
        height: argv.height,
        lightMode: argv.light,
        title: argv.title,
        showLegend: !argv.noLegend,
      });

      if (!chartBuffer) {
        logger.error("Failed to render chart image");
        process.exit(1);
      }

      // Write to file
      fs.writeFileSync(argv.output, chartBuffer);
      logger.info(`Chart saved to ${argv.output}`);
    } else if (argv.format === "html") {
      const htmlContent = ChartRenderer.renderHTML(chartData, {
        width: argv.width,
        height: argv.height,
        lightMode: argv.light,
        title: argv.title,
        showLegend: !argv.noLegend,
      });

      // Write to file
      fs.writeFileSync(argv.output, htmlContent);
      logger.info(`HTML chart saved to ${argv.output}`);
    }

    logger.info("Chart generation completed");
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Chart generation failed"
    );
    process.exit(1);
  } finally {
    // Always disconnect from the database
    await prisma.$disconnect();
  }
};
