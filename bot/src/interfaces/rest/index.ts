import express from "express";
import cors from "cors";
import helmet from "helmet";
import { logger } from "../../lib/logger";
import { chartRoutes } from "./routes/chart";
import { apiKeyMiddleware } from "./middleware/auth";

/**
 * Initialize the REST API server
 * @param port Port to listen on (default: 3000)
 * @returns Express application instance
 */
export function createServer(port: number = 3000): express.Application {
  const app = express();

  // Common middleware
  app.use(helmet()); // Security headers
  app.use(cors()); // CORS support
  app.use(express.json()); // JSON body parsing
  app.use(express.urlencoded({ extended: true })); // Form data parsing

  // Logging middleware
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
  });

  // API routes
  app.use("/api/charts", apiKeyMiddleware, chartRoutes);

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Error handling middleware
  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      logger.error(
        {
          error: err.message,
          stack: err.stack,
          method: req.method,
          url: req.url,
        },
        "Server error"
      );

      res.status(500).json({
        error: "Internal server error",
        message:
          process.env.NODE_ENV === "production" ? undefined : err.message,
      });
    }
  );

  return app;
}

/**
 * Start the server
 * @param port Port to listen on (default: process.env.PORT or 3000)
 */
export function startServer(port?: number): void {
  const serverPort = port || Number(process.env.PORT) || 3000;
  const app = createServer(serverPort);

  app.listen(serverPort, () => {
    logger.info(`Server listening on port ${serverPort}`);
  });
}
