import { FeatureFlags } from '../../../../src/shared/utilities/feature-flags';

describe('FeatureFlags', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('isEnabled', () => {
    it('should return false for undefined feature', () => {
      delete process.env.FEATURE_TEST_FEATURE;
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(false);
    });

    it('should return true for feature set to "true"', () => {
      process.env.FEATURE_TEST_FEATURE = 'true';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(true);
    });

    it('should return true for feature set to "1"', () => {
      process.env.FEATURE_TEST_FEATURE = '1';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(true);
    });

    it('should return true for feature set to "yes"', () => {
      process.env.FEATURE_TEST_FEATURE = 'yes';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(true);
    });

    it('should return true for feature set to "on"', () => {
      process.env.FEATURE_TEST_FEATURE = 'on';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(true);
    });

    it('should return false for feature set to "false"', () => {
      process.env.FEATURE_TEST_FEATURE = 'false';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(false);
    });

    it('should return false for feature set to "0"', () => {
      process.env.FEATURE_TEST_FEATURE = '0';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(false);
    });

    it('should return false for feature set to "no"', () => {
      process.env.FEATURE_TEST_FEATURE = 'no';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(false);
    });

    it('should return false for feature set to "off"', () => {
      process.env.FEATURE_TEST_FEATURE = 'off';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(false);
    });

    it('should return false for feature set to random string', () => {
      process.env.FEATURE_TEST_FEATURE = 'random';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(false);
    });

    it('should return false for feature set to empty string', () => {
      process.env.FEATURE_TEST_FEATURE = '';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(false);
    });

    it('should be case insensitive', () => {
      process.env.FEATURE_TEST_FEATURE = 'TRUE';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(true);

      process.env.FEATURE_TEST_FEATURE = 'True';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(true);

      process.env.FEATURE_TEST_FEATURE = 'YES';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(true);

      process.env.FEATURE_TEST_FEATURE = 'FALSE';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(false);

      process.env.FEATURE_TEST_FEATURE = 'False';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(false);
    });

    it('should handle features with underscores', () => {
      process.env.FEATURE_ADVANCED_ANALYTICS_ENABLED = 'true';
      expect(FeatureFlags.isEnabled('ADVANCED_ANALYTICS_ENABLED')).toBe(true);
    });

    it('should handle features with numbers', () => {
      process.env.FEATURE_NEW_UI_V2 = 'true';
      expect(FeatureFlags.isEnabled('NEW_UI_V2')).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should return all feature flags', () => {
      process.env.FEATURE_TEST_FEATURE1 = 'true';
      process.env.FEATURE_TEST_FEATURE2 = 'false';
      process.env.FEATURE_TEST_FEATURE3 = '1';
      process.env.NOT_A_FEATURE = 'true'; // Should not be included

      const flags = FeatureFlags.getAll();

      expect(flags).toEqual({
        TEST_FEATURE1: true,
        TEST_FEATURE2: false,
        TEST_FEATURE3: true,
      });
      expect(flags).not.toHaveProperty('NOT_A_FEATURE');
    });

    it('should return empty object when no feature flags exist', () => {
      // Remove all FEATURE_ environment variables
      Object.keys(process.env).forEach(key => {
        if (key.startsWith('FEATURE_')) {
          delete process.env[key];
        }
      });

      const flags = FeatureFlags.getAll();
      expect(flags).toEqual({});
    });

    it('should handle mixed case environment variables', () => {
      process.env.FEATURE_test_feature = 'true';
      process.env.feature_another_test = 'false'; // Should not be included (doesn't start with FEATURE_)

      const flags = FeatureFlags.getAll();

      expect(flags).toEqual({
        test_feature: true,
      });
    });
  });

  describe('set', () => {
    it('should set feature flag to enabled', () => {
      FeatureFlags.set('TEST_FEATURE', true);
      expect(process.env.FEATURE_TEST_FEATURE).toBe('true');
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(true);
    });

    it('should set feature flag to disabled', () => {
      FeatureFlags.set('TEST_FEATURE', false);
      expect(process.env.FEATURE_TEST_FEATURE).toBe('false');
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(false);
    });

    it('should override existing feature flag', () => {
      process.env.FEATURE_TEST_FEATURE = 'true';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(true);

      FeatureFlags.set('TEST_FEATURE', false);
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(false);
    });

    it('should handle features with special characters', () => {
      FeatureFlags.set('FEATURE_WITH_NUMBERS_123', true);
      expect(FeatureFlags.isEnabled('FEATURE_WITH_NUMBERS_123')).toBe(true);
    });
  });

  describe('unset', () => {
    it('should remove feature flag', () => {
      process.env.FEATURE_TEST_FEATURE = 'true';
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(true);

      FeatureFlags.unset('TEST_FEATURE');
      expect(process.env.FEATURE_TEST_FEATURE).toBeUndefined();
      expect(FeatureFlags.isEnabled('TEST_FEATURE')).toBe(false);
    });

    it('should handle unsetting non-existent feature', () => {
      expect(() => FeatureFlags.unset('NON_EXISTENT_FEATURE')).not.toThrow();
      expect(FeatureFlags.isEnabled('NON_EXISTENT_FEATURE')).toBe(false);
    });
  });

  describe('reset', () => {
    it('should remove all feature flags', () => {
      process.env.FEATURE_TEST1 = 'true';
      process.env.FEATURE_TEST2 = 'false';
      process.env.FEATURE_TEST3 = '1';
      process.env.NOT_A_FEATURE = 'true'; // Should remain

      FeatureFlags.reset();

      expect(process.env.FEATURE_TEST1).toBeUndefined();
      expect(process.env.FEATURE_TEST2).toBeUndefined();
      expect(process.env.FEATURE_TEST3).toBeUndefined();
      expect(process.env.NOT_A_FEATURE).toBe('true'); // Should remain unchanged
    });

    it('should work when no feature flags exist', () => {
      expect(() => FeatureFlags.reset()).not.toThrow();
    });
  });
});