import { MapActivity } from '../../../src/domain/activity/MapActivity';

describe('MapActivity', () => {
  let activity: MapActivity;

  beforeEach(() => {
    activity = new MapActivity({
      characterId: 100n,
      timestamp: new Date('2023-01-01T12:00:00Z'),
      signatures: 5,
      connections: 3,
      passages: 10,
      allianceId: 99000001,
      corporationId: 98000001,
    });
  });

  describe('constructor', () => {
    it('should create a map activity instance', () => {
      expect(activity).toBeInstanceOf(MapActivity);
    });

    it('should initialize with provided values', () => {
      expect(activity.characterId).toBe(100n);
      expect(activity.timestamp).toEqual(new Date('2023-01-01T12:00:00Z'));
      expect(activity.signatures).toBe(5);
      expect(activity.connections).toBe(3);
      expect(activity.passages).toBe(10);
      expect(activity.allianceId).toBe(99000001);
      expect(activity.corporationId).toBe(98000001);
    });

    it('should handle null allianceId', () => {
      const activityWithoutAlliance = new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 0,
        connections: 0,
        passages: 0,
        allianceId: null,
        corporationId: 98000001,
      });

      expect(activityWithoutAlliance.allianceId).toBeNull();
    });

    it('should default allianceId to null if not provided', () => {
      const activityWithoutAlliance = new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      });

      expect(activityWithoutAlliance.allianceId).toBeNull();
    });
  });

  describe('validate', () => {
    it('should not throw for valid activity', () => {
      expect(() => activity.validate()).not.toThrow();
    });

    it('should throw when characterId is missing', () => {
      expect(() => new MapActivity({
        characterId: undefined as any,
        timestamp: new Date(),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      })).toThrow('Map activity must have a character ID');
    });

    it('should throw when timestamp is missing', () => {
      expect(() => new MapActivity({
        characterId: 100n,
        timestamp: undefined as any,
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      })).toThrow('Map activity must have a timestamp');
    });

    it('should accept undefined corporationId (current behavior)', () => {
      // The validation corporationId <= 0 returns false for undefined
      // so it doesn't throw. This documents current behavior.
      const activity = new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: undefined as any,
      });
      
      expect(activity.corporationId).toBeUndefined();
    });

    it('should throw when signatures is negative', () => {
      expect(() => new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: -1,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      })).toThrow('Signatures count cannot be negative');
    });

    it('should throw when connections is negative', () => {
      expect(() => new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 0,
        connections: -1,
        passages: 0,
        corporationId: 98000001,
      })).toThrow('Connections count cannot be negative');
    });

    it('should throw when passages is negative', () => {
      expect(() => new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 0,
        connections: 0,
        passages: -1,
        corporationId: 98000001,
      })).toThrow('Passages count cannot be negative');
    });

    it('should throw when corporationId is invalid', () => {
      expect(() => new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 0,
      })).toThrow('Map activity must have a valid corporation ID');
    });

    it('should throw when allianceId is invalid', () => {
      expect(() => new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
        allianceId: 0,
      })).toThrow('If alliance ID is provided, it must be valid');
    });
  });

  describe('hasActivity', () => {
    it('should return true when any activity is present', () => {
      expect(activity.hasActivity()).toBe(true);
    });

    it('should return true when only signatures are present', () => {
      const sigActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 1,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      });
      expect(sigActivity.hasActivity()).toBe(true);
    });

    it('should return true when only connections are present', () => {
      const connActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 0,
        connections: 1,
        passages: 0,
        corporationId: 98000001,
      });
      expect(connActivity.hasActivity()).toBe(true);
    });

    it('should return true when only passages are present', () => {
      const passActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 0,
        connections: 0,
        passages: 1,
        corporationId: 98000001,
      });
      expect(passActivity.hasActivity()).toBe(true);
    });

    it('should return false when no activity is present', () => {
      const noActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      });
      expect(noActivity.hasActivity()).toBe(false);
    });
  });

  describe('activityScore', () => {
    it('should calculate score based on weighted activities', () => {
      // signatures: 5 * 2 = 10
      // connections: 3 * 1 = 3
      // passages: 10 * 1 = 10
      // total: 23
      expect(activity.activityScore()).toBe(23);
    });

    it('should return 0 for no activity', () => {
      const noActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      });
      expect(noActivity.activityScore()).toBe(0);
    });

    it('should weight signatures double', () => {
      const sigOnlyActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 1,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      });
      expect(sigOnlyActivity.activityScore()).toBe(2);
    });

    it('should weight connections normally', () => {
      const connOnlyActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 0,
        connections: 1,
        passages: 0,
        corporationId: 98000001,
      });
      expect(connOnlyActivity.activityScore()).toBe(1);
    });

    it('should weight passages normally', () => {
      const passOnlyActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 0,
        connections: 0,
        passages: 1,
        corporationId: 98000001,
      });
      expect(passOnlyActivity.activityScore()).toBe(1);
    });
  });

  describe('getTimeKey', () => {
    it('should return formatted day key by default', () => {
      const testActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date('2023-06-15T14:30:45Z'),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      });
      expect(testActivity.getTimeKey()).toBe('2023-6-15');
    });

    it('should return hour format when requested', () => {
      const testActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date('2023-06-15T14:30:45Z'),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      });
      expect(testActivity.getTimeKey('hour')).toBe('2023-6-15-14');
    });

    it('should return raw ISO format when requested', () => {
      const testActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date('2023-06-15T14:30:45Z'),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      });
      expect(testActivity.getTimeKey('raw')).toBe('2023-06-15T14:30:45.000Z');
    });

    it('should handle January correctly (month is 0-indexed)', () => {
      const testActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date('2023-01-01T01:30:00Z'),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      });
      expect(testActivity.getTimeKey()).toBe('2023-1-1');
      expect(testActivity.getTimeKey('hour')).toBe('2023-1-1-1');
    });

    it('should handle December correctly', () => {
      const testActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date('2023-12-31T23:59:59Z'),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      });
      expect(testActivity.getTimeKey()).toBe('2023-12-31');
      expect(testActivity.getTimeKey('hour')).toBe('2023-12-31-23');
    });
  });

  describe('toObject', () => {
    it('should return object representation', () => {
      const obj = activity.toObject();

      expect(obj).toEqual({
        characterId: 100n,
        timestamp: new Date('2023-01-01T12:00:00Z'),
        signatures: 5,
        connections: 3,
        passages: 10,
        allianceId: 99000001,
        corporationId: 98000001,
      });
    });

    it('should include null allianceId', () => {
      const activityWithoutAlliance = new MapActivity({
        characterId: 100n,
        timestamp: new Date('2023-01-01T12:00:00Z'),
        signatures: 0,
        connections: 0,
        passages: 0,
        allianceId: null,
        corporationId: 98000001,
      });

      const obj = activityWithoutAlliance.toObject();

      expect(obj).toHaveProperty('allianceId');
      expect(obj.allianceId).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle very large activity numbers', () => {
      const hyperActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date(),
        signatures: 1000,
        connections: 500,
        passages: 10000,
        corporationId: 98000001,
      });

      expect(hyperActivity.hasActivity()).toBe(true);
      expect(hyperActivity.activityScore()).toBe(12500); // (1000*2) + 500 + 10000
    });

    it('should handle timestamps far in the past', () => {
      const oldActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date('1970-01-01T00:00:00Z'),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      });
      expect(oldActivity.getTimeKey()).toBe('1970-1-1');
    });

    it('should handle timestamps in the future', () => {
      const futureActivity = new MapActivity({
        characterId: 100n,
        timestamp: new Date('2099-12-31T23:59:59Z'),
        signatures: 0,
        connections: 0,
        passages: 0,
        corporationId: 98000001,
      });
      expect(futureActivity.getTimeKey()).toBe('2099-12-31');
    });
  });
});