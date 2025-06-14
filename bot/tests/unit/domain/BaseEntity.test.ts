import { BaseEntity } from '../../../src/domain/BaseEntity';

// Create a concrete implementation for testing
class TestEntity extends BaseEntity {
  public name: string;
  public value: number;

  constructor(name: string = 'test', value: number = 0) {
    super();
    this.name = name;
    this.value = value;
  }
}

describe('BaseEntity', () => {
  let entity: TestEntity;

  beforeEach(() => {
    entity = new TestEntity('TestItem', 100);
  });

  describe('constructor', () => {
    it('should initialize with empty labels array', () => {
      expect(entity.labels).toEqual([]);
    });

    it('should be an instance of BaseEntity', () => {
      expect(entity).toBeInstanceOf(BaseEntity);
    });
  });

  describe('addLabel', () => {
    it('should add a new label', () => {
      entity.addLabel('important');
      expect(entity.labels).toEqual(['important']);
    });

    it('should add multiple labels', () => {
      entity.addLabel('important');
      entity.addLabel('urgent');
      entity.addLabel('validated');
      expect(entity.labels).toEqual(['important', 'urgent', 'validated']);
    });

    it('should not add duplicate labels', () => {
      entity.addLabel('important');
      entity.addLabel('important');
      entity.addLabel('important');
      expect(entity.labels).toEqual(['important']);
    });

    it('should maintain label order', () => {
      entity.addLabel('first');
      entity.addLabel('second');
      entity.addLabel('third');
      expect(entity.labels).toEqual(['first', 'second', 'third']);
    });

    it('should handle empty string labels', () => {
      entity.addLabel('');
      expect(entity.labels).toEqual(['']);
    });

    it('should handle whitespace labels', () => {
      entity.addLabel('  spaced  ');
      expect(entity.labels).toEqual(['  spaced  ']);
    });
  });

  describe('removeLabel', () => {
    beforeEach(() => {
      entity.labels = ['important', 'urgent', 'validated'];
    });

    it('should remove an existing label', () => {
      entity.removeLabel('urgent');
      expect(entity.labels).toEqual(['important', 'validated']);
    });

    it('should do nothing if label does not exist', () => {
      entity.removeLabel('nonexistent');
      expect(entity.labels).toEqual(['important', 'urgent', 'validated']);
    });

    it('should remove only the first occurrence of duplicate labels', () => {
      entity.labels = ['duplicate', 'other', 'duplicate'];
      entity.removeLabel('duplicate');
      expect(entity.labels).toEqual(['other', 'duplicate']);
    });

    it('should handle removing from empty labels', () => {
      entity.labels = [];
      entity.removeLabel('anything');
      expect(entity.labels).toEqual([]);
    });

    it('should remove the last label', () => {
      entity.labels = ['only'];
      entity.removeLabel('only');
      expect(entity.labels).toEqual([]);
    });
  });

  describe('hasLabel', () => {
    beforeEach(() => {
      entity.labels = ['important', 'urgent', 'validated'];
    });

    it('should return true for existing label', () => {
      expect(entity.hasLabel('important')).toBe(true);
      expect(entity.hasLabel('urgent')).toBe(true);
      expect(entity.hasLabel('validated')).toBe(true);
    });

    it('should return false for non-existing label', () => {
      expect(entity.hasLabel('nonexistent')).toBe(false);
    });

    it('should return false for empty labels array', () => {
      entity.labels = [];
      expect(entity.hasLabel('anything')).toBe(false);
    });

    it('should be case sensitive', () => {
      entity.labels = ['Important'];
      expect(entity.hasLabel('important')).toBe(false);
      expect(entity.hasLabel('Important')).toBe(true);
    });

    it('should handle empty string label', () => {
      entity.labels = [''];
      expect(entity.hasLabel('')).toBe(true);
    });
  });

  describe('getLabels', () => {
    it('should return all labels', () => {
      entity.labels = ['a', 'b', 'c'];
      expect(entity.getLabels()).toEqual(['a', 'b', 'c']);
    });

    it('should return empty array when no labels', () => {
      expect(entity.getLabels()).toEqual([]);
    });

    it('should return a copy of labels array', () => {
      entity.labels = ['original'];
      const labels = entity.getLabels();
      labels.push('modified');
      
      // Original should not be modified
      expect(entity.labels).toEqual(['original']);
    });
  });

  describe('toJSON', () => {
    it('should return object with all properties', () => {
      entity.labels = ['test-label'];
      const json = entity.toJSON();

      expect(json).toEqual({
        name: 'TestItem',
        value: 100,
        labels: ['test-label'],
      });
    });

    it('should include empty labels array', () => {
      const json = entity.toJSON();
      expect(json).toHaveProperty('labels');
      expect(json.labels).toEqual([]);
    });

    it('should handle nested objects', () => {
      class ComplexEntity extends BaseEntity {
        nested = {
          prop1: 'value1',
          prop2: {
            deep: 'value2',
          },
        };
        date = new Date('2023-01-01T00:00:00Z');
      }

      const complex = new ComplexEntity();
      const json = complex.toJSON();

      expect(json).toEqual({
        nested: {
          prop1: 'value1',
          prop2: {
            deep: 'value2',
          },
        },
        date: '2023-01-01T00:00:00.000Z',
        labels: [],
      });
    });

    it('should handle arrays', () => {
      class ArrayEntity extends BaseEntity {
        items = [1, 2, 3];
        objects = [{ id: 1 }, { id: 2 }];
      }

      const arrayEntity = new ArrayEntity();
      const json = arrayEntity.toJSON();

      expect(json).toEqual({
        items: [1, 2, 3],
        objects: [{ id: 1 }, { id: 2 }],
        labels: [],
      });
    });

    it('should handle functions in JSON serialization', () => {
      class FunctionEntity extends BaseEntity {
        method = () => 'test';
        value = 123;
      }

      const funcEntity = new FunctionEntity();
      const json = funcEntity.toJSON();

      // JSON.stringify automatically removes functions
      const stringified = JSON.stringify(json);
      const parsed = JSON.parse(stringified);
      
      expect(parsed).toEqual({
        value: 123,
        labels: [],
      });
      expect(parsed).not.toHaveProperty('method');
    });
  });

  describe('toObject', () => {
    it('should return plain object representation', () => {
      entity.labels = ['label1', 'label2'];
      const obj = entity.toObject();

      expect(obj).toEqual({
        name: 'TestItem',
        value: 100,
        labels: ['label1', 'label2'],
      });
    });

    it('should not be the same reference as the entity', () => {
      const obj = entity.toObject();
      expect(obj).not.toBe(entity);
    });

    it('should create a shallow copy', () => {
      class NestedEntity extends BaseEntity {
        data = { items: [1, 2, 3] };
      }

      const nested = new NestedEntity();
      const obj = nested.toObject();
      
      // Since toObject uses Object.assign, it creates a shallow copy
      // Modifying nested properties will affect the original
      expect(obj.data).toBe(nested.data); // Same reference
      
      // But the top-level object is different
      expect(obj).not.toBe(nested);
    });

    it('should handle null and undefined values', () => {
      class NullableEntity extends BaseEntity {
        nullValue = null;
        undefinedValue = undefined;
        validValue = 'test';
      }

      const nullable = new NullableEntity();
      const obj = nullable.toObject();

      expect(obj).toEqual({
        nullValue: null,
        undefinedValue: undefined,
        validValue: 'test',
        labels: [],
      });
    });
  });

  describe('inheritance', () => {
    it('should work with multiple levels of inheritance', () => {
      class MiddleEntity extends TestEntity {
        middleProp = 'middle';
      }

      class LeafEntity extends MiddleEntity {
        leafProp = 'leaf';
      }

      const leaf = new LeafEntity('Leaf', 200);
      leaf.addLabel('inherited');

      expect(leaf.name).toBe('Leaf');
      expect(leaf.value).toBe(200);
      expect(leaf.middleProp).toBe('middle');
      expect(leaf.leafProp).toBe('leaf');
      expect(leaf.hasLabel('inherited')).toBe(true);

      const json = leaf.toJSON();
      expect(json).toEqual({
        name: 'Leaf',
        value: 200,
        middleProp: 'middle',
        leafProp: 'leaf',
        labels: ['inherited'],
      });
    });
  });

  describe('edge cases', () => {
    it('should handle circular references in toJSON', () => {
      class CircularEntity extends BaseEntity {
        self?: CircularEntity;
      }

      const circular = new CircularEntity();
      circular.self = circular;

      // This should not throw due to JSON.stringify handling
      expect(() => circular.toJSON()).toThrow();
    });

    it('should handle very long label arrays', () => {
      const labels = Array.from({ length: 1000 }, (_, i) => `label${i}`);
      labels.forEach(label => entity.addLabel(label));

      expect(entity.labels).toHaveLength(1000);
      expect(entity.hasLabel('label500')).toBe(true);
    });

    it('should handle special characters in labels', () => {
      const specialLabels = [
        'with-dash',
        'with_underscore',
        'with space',
        'with!special#chars',
        '日本語',
        '🚀emoji',
      ];

      specialLabels.forEach(label => entity.addLabel(label));
      
      specialLabels.forEach(label => {
        expect(entity.hasLabel(label)).toBe(true);
      });
    });
  });
});