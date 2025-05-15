// Configuration options for the application

export const config = {
  // Cache settings
  cache: {
    // Default TTL for cache entries in milliseconds
    defaultTTL: 5 * 60 * 1000, // 5 minutes

    // Whether to enable caching
    enabled: true,
  },

  // API settings
  api: {
    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    },
  },
};
