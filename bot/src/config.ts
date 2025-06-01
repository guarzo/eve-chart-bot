/**
 * Application configuration
 */

import { config } from "dotenv";
config(); // Load environment variables from .env file

// Core configuration
export const NODE_ENV = process.env.NODE_ENV || "development";

// Discord configuration
export const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!DISCORD_BOT_TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN environment variable is required");
}

// Map configuration
export const MAP_URL = process.env.MAP_URL;
export const MAP_NAME = process.env.MAP_NAME;
export const MAP_API_TOKEN = process.env.MAP_API_TOKEN;

// Validate required map configuration
if (NODE_ENV !== "test") {
  if (!MAP_URL) {
    throw new Error("MAP_URL environment variable is required");
  }
  if (!MAP_NAME) {
    throw new Error("MAP_NAME environment variable is required");
  }
  if (!MAP_API_TOKEN) {
    throw new Error("MAP_API_TOKEN environment variable is required");
  }
}

// Internal configuration (not configurable via env vars)
export const INTERNAL_CONFIG = {
  // Database
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/evechartbot",

  // Redis
  REDIS_URL: "redis://localhost:6379",
  CACHE_TTL: 300, // 5 minutes

  // API endpoints
  ESI_BASE_URL: "https://esi.evetech.net/latest",
  ZKILLBOARD_BASE_URL: "https://zkillboard.com/api",

  // HTTP settings
  HTTP_TIMEOUT: 30000, // 30 seconds
  HTTP_MAX_RETRIES: 3,
  HTTP_INITIAL_RETRY_DELAY: 1000, // 1 second
  HTTP_MAX_RETRY_DELAY: 45000, // 45 seconds

  // Rate limiting
  RATE_LIMIT_MIN_DELAY: 1000, // 1 second
  RATE_LIMIT_MAX_DELAY: 10000, // 10 seconds
} as const;
