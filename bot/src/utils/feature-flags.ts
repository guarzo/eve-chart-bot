/**
 * Feature flags configuration for toggling features
 */

/**
 * Helper to convert string to boolean
 * @param value The string value
 * @param defaultValue The default value if not set
 * @returns boolean representation
 */
function getBooleanFlag(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === "true";
}

/**
 * Feature flags for the application
 */
export const flags = {
  /**
   * Enable the new chart rendering system
   */
  newChartRendering: getBooleanFlag(
    process.env.FEATURE_NEW_CHART_RENDERING,
    false
  ),

  /**
   * Enable Redis caching
   */
  redisCache: getBooleanFlag(process.env.FEATURE_REDIS_CACHE, true),

  /**
   * Enable the new ingestion service
   */
  newIngestionService: getBooleanFlag(
    process.env.FEATURE_NEW_INGESTION_SERVICE,
    false
  ),

  /**
   * Enable AWOX detection in the ingestion service
   */
  awoxDetection: getBooleanFlag(process.env.FEATURE_AWOX_DETECTION, false),
};

/**
 * Check if a feature flag is enabled
 * @param flagName The name of the flag to check
 * @returns Whether the flag is enabled
 */
export function isFeatureEnabled(flagName: keyof typeof flags): boolean {
  return flags[flagName];
}
