import { Router, Request, Response } from "express";
import { ChartService } from "../../../application/chart/ChartService";
import { ChartRenderer } from "../../../application/chart/ChartRenderer";
import { logger } from "../../../lib/logger";

// Create router
export const chartRoutes = Router();

// Initialize services
const chartService = new ChartService();

/**
 * GET /api/charts/ship-usage
 * Generate a ship usage chart
 */
chartRoutes.get("/ship-usage", async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const characterId = req.query.characterId as string | undefined;
    const groupId = req.query.groupId as string | undefined;
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const format = ((req.query.format as string) || "json").toLowerCase();

    // Validate required parameters
    if (!characterId && !groupId) {
      return res.status(400).json({
        error: "Either characterId or groupId is required",
      });
    }

    // Get chart data
    const chartData = await chartService.generateShipUsageChart(
      characterId,
      groupId,
      days
    );

    if (!chartData) {
      return res.status(404).json({
        error: "No chart data available",
      });
    }

    // Handle different output formats
    if (format === "png") {
      // Render chart as PNG
      const width = req.query.width ? parseInt(req.query.width as string) : 800;
      const height = req.query.height
        ? parseInt(req.query.height as string)
        : 600;
      const lightMode = req.query.lightMode === "true";
      const showLegend = req.query.showLegend !== "false";
      const title = req.query.title as string | undefined;

      const chartBuffer = await ChartRenderer.renderPNG(chartData, {
        width,
        height,
        lightMode,
        showLegend,
        title,
      });

      if (!chartBuffer) {
        return res.status(500).json({
          error: "Failed to render chart",
        });
      }

      // Send the PNG image
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Length", chartBuffer.length);
      return res.send(chartBuffer);
    } else if (format === "html") {
      // Render chart as HTML
      const width = req.query.width ? parseInt(req.query.width as string) : 800;
      const height = req.query.height
        ? parseInt(req.query.height as string)
        : 600;
      const lightMode = req.query.lightMode === "true";
      const showLegend = req.query.showLegend !== "false";
      const title = (req.query.title as string) || "Ship Usage Chart";

      const html = ChartRenderer.renderHTML(chartData, {
        width,
        height,
        lightMode,
        showLegend,
        title,
      });

      // Send the HTML
      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } else {
      // Default to JSON
      return res.json(chartData);
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        query: req.query,
      },
      "Error generating ship usage chart"
    );

    return res.status(500).json({
      error: "Failed to generate chart",
      message:
        process.env.NODE_ENV === "production"
          ? undefined
          : error instanceof Error
          ? error.message
          : String(error),
    });
  }
});

/**
 * GET /api/charts/kills-by-system
 * Generate a kills by system chart
 */
chartRoutes.get("/kills-by-system", async (req: Request, res: Response) => {
  // Not yet implemented
  res.status(501).json({
    error: "Not implemented yet",
  });
});

/**
 * GET /api/charts/damage-dealt
 * Generate a damage dealt chart
 */
chartRoutes.get("/damage-dealt", async (req: Request, res: Response) => {
  // Not yet implemented
  res.status(501).json({
    error: "Not implemented yet",
  });
});
