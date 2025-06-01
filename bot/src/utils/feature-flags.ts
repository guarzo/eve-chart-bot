/**
 * Feature flags configuration for toggling features
 */

import { FEATURE_FLAGS } from "../config";

/**
 * Feature flags for the application
 */
export const flags = FEATURE_FLAGS;

/**
 * Check if a feature flag is enabled
 * @param flagName The name of the flag to check
 * @returns Whether the flag is enabled
 */
export function isFeatureEnabled(flagName: keyof typeof flags): boolean {
  return flags[flagName];
}
