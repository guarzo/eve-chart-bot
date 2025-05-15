import { Request, Response, NextFunction } from "express";
import { PrismaClient, Character } from "@prisma/client";
import { logger } from "../../../lib/logger";

const prisma = new PrismaClient();

// Extend Express Request type to include character
declare global {
  namespace Express {
    interface Request {
      character?: Character;
    }
  }
}

type MiddlewareResponse = Response<any, Record<string, any>> | undefined;

/**
 * Middleware to authenticate API requests using an API key
 */
export function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Response | void {
  // Get the API key from the environment variable
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    logger.warn("API_KEY environment variable is not set");
    return res.status(500).json({ error: "API key configuration error" });
  }

  // Get the provided API key from the request headers or query string
  const providedApiKey =
    req.headers["x-api-key"] || (req.query.apiKey as string);

  // Check if the API key was provided and is valid
  if (!providedApiKey) {
    logger.warn(
      {
        ip: req.ip,
        method: req.method,
        url: req.url,
      },
      "API request missing API key"
    );
    return res.status(401).json({ error: "API key is required" });
  }

  if (providedApiKey !== validApiKey) {
    logger.warn(
      {
        ip: req.ip,
        method: req.method,
        url: req.url,
      },
      "Invalid API key provided"
    );
    return res.status(403).json({ error: "Invalid API key" });
  }

  // API key is valid, continue
  next();
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }

  try {
    const character = await prisma.character.findFirst({
      where: {
        eveId: apiKey as string,
      },
    });

    if (!character) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    req.character = character;
    next();
  } catch (error) {
    logger.error("Error in auth middleware:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function requireMainCharacter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.character) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!req.character.isMain) {
    return res.status(403).json({ error: "Main character required" });
  }

  next();
}

export async function requireGroupMember(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.character) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!req.character.characterGroupId) {
    return res.status(403).json({ error: "Character must be in a group" });
  }

  next();
}

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.headers.authorization) {
    res.status(401).json({ error: "No authorization header" });
    return;
  }
  // Add admin check logic here
  next();
};

export const requireApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.headers["x-api-key"]) {
    res.status(401).json({ error: "No API key provided" });
    return;
  }
  // Add API key validation logic here
  next();
};
