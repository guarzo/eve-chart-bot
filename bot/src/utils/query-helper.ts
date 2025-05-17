/**
 * Helper functions for building Prisma queries
 */

/**
 * Builds a where filter object for Prisma queries based on a set of filters.
 * Automatically handles date fields by converting them to 'gte' operators.
 *
 * @param filters The filters to apply
 * @returns A where filter object for Prisma
 */
export function buildWhereFilter(filters: Record<string, any>) {
  return Object.entries(filters).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }

    // Handle date fields
    if (key.toLowerCase().includes("date") && value instanceof Date) {
      acc[key] = { gte: value };
    }
    // Handle array values
    else if (Array.isArray(value)) {
      if (value.length > 0) {
        acc[key] = { in: value };
      }
    }
    // Handle simple values
    else {
      acc[key] = value;
    }

    return acc;
  }, {} as Record<string, any>);
}

/**
 * Builds a pagination object for Prisma queries
 *
 * @param page The page number (1-based)
 * @param pageSize The number of items per page
 * @returns A pagination object with skip and take values
 */
export function buildPagination(page: number = 1, pageSize: number = 10) {
  const skip = (page - 1) * pageSize;
  return {
    skip,
    take: pageSize,
  };
}
