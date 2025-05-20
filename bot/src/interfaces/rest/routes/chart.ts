import { Router, Request, Response } from "express";
import { ChartService } from "../../../services/ChartService";
import { ChartRenderer } from "../../../services/ChartRenderer";
import { logger } from "../../../lib/logger";
import { asyncHandler } from "../middleware/error-handler";
import { ValidationError, ExternalServiceError } from "../../../lib/errors";

// Create router
const chartRoutes = Router();

// Initialize services
const chartService = new ChartService();
const chartRenderer = new ChartRenderer();

// Helper function to validate date range
function validateDateRange(
  startDate: string | undefined,
  endDate: string | undefined
) {
  if (startDate && isNaN(Date.parse(startDate))) {
    throw new ValidationError("Invalid start date format");
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    throw new ValidationError("Invalid end date format");
  }
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw new ValidationError("Start date must be before end date");
  }
}

/**
 * GET /api/charts/ship-usage
 * Generate a ship usage chart
 */
chartRoutes.get(
  "/ship-usage",
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, groupId } = req.query;

    // Validate date range
    validateDateRange(startDate as string, endDate as string);

    try {
      const chartData = await chartService.generateShipUsageChart(
        groupId as string,
        startDate as string,
        endDate as string
      );

      const chartBuffer = await chartRenderer.renderChart(chartData);
      res.setHeader("Content-Type", "image/png");
      res.send(chartBuffer);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ExternalServiceError("Failed to generate ship usage chart", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })
);

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

export { chartRoutes };
