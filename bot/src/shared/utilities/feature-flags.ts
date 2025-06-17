/**
 * Feature flags configuration for toggling features
 */

import { ValidatedConfiguration } from '../../config/validated';

/**
 * Feature flags for the application
 */
export const flags = ValidatedConfiguration.features;

/**
 * Check if a feature flag is enabled
 * @param flagName The name of the flag to check
 * @returns Whether the flag is enabled
 */
export function isFeatureEnabled(flagName: keyof typeof flags): boolean {
  return flags[flagName];
}

/**
 * Feature flags utility class for environment variable based feature flags
 */
export class FeatureFlags {
  /**
   * Check if a feature flag is enabled via environment variables
   * @param featureName The name of the feature flag
   * @returns Whether the feature is enabled
   */
  static isEnabled(featureName: string): boolean {
    const envVarName = `FEATURE_${featureName}`;
    const value = process.env[envVarName];

    if (!value) return false;

    const normalizedValue = value.toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(normalizedValue);
  }

  /**
   * Get all feature flags from environment
   * @returns Object with all feature flags
   */
  static getAll(): Record<string, boolean> {
    const flags: Record<string, boolean> = {};

    // eslint-disable-next-line no-unused-vars
    for (const [key, _value] of Object.entries(process.env)) {
      if (key.startsWith('FEATURE_')) {
        const featureName = key.replace('FEATURE_', '');
        flags[featureName] = this.isEnabled(featureName);
      }
    }

    return flags;
  }

  /**
   * Set a feature flag
   * @param featureName The name of the feature flag
   * @param enabled Whether the feature should be enabled
   */
  static set(featureName: string, enabled: boolean): void {
    const envVarName = `FEATURE_${featureName}`;
    process.env[envVarName] = enabled ? 'true' : 'false';
  }

  /**
   * Remove a feature flag
   * @param featureName The name of the feature flag
   */
  static unset(featureName: string): void {
    const envVarName = `FEATURE_${featureName}`;
    delete process.env[envVarName];
  }

  /**
   * Remove all feature flags
   */
  static reset(): void {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('FEATURE_')) {
        delete process.env[key];
      }
    }
  }
}
