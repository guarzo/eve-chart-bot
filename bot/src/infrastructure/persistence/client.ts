import { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger';

// Initialize a single PrismaClient instance to be used throughout the application
const prisma = new PrismaClient();

// Log queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    logger.debug(`Query: ${e.query}`);
    logger.debug(`Duration: ${e.duration}ms`);
  });
}

export default prisma;
