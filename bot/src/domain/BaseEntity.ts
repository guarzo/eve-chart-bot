/**
 * Base entity class providing common functionality for domain entities
 */
export abstract class BaseEntity {
  /** Labels or tags applied to this entity */
  protected labels: string[] = [];

  /**
   * Add a label to this entity
   */
  addLabel(label: string): void {
    if (!this.labels.includes(label)) {
      this.labels.push(label);
    }
  }

  /**
   * Remove a label from this entity
   */
  removeLabel(label: string): void {
    const index = this.labels.indexOf(label);
    if (index >= 0) {
      this.labels.splice(index, 1);
    }
  }

  /**
   * Check if this entity has a specific label
   */
  hasLabel(label: string): boolean {
    return this.labels.includes(label);
  }

  /**
   * Get all labels for this entity
   */
  getLabels(): string[] {
    return [...this.labels];
  }

  /**
   * Default toJSON implementation that serializes all public and protected fields
   * Can be overridden by subclasses for custom serialization
   */
  toJSON(): Record<string, any> {
    const result: Record<string, any> = {};

    // Get all enumerable properties
    for (const key in this) {
      if (Object.prototype.hasOwnProperty.call(this, key)) {
        const value = this[key];

        // Handle BigInt conversion to string
        if (typeof value === 'bigint') {
          result[key] = value.toString();
        }
        // Handle Date conversion to ISO string
        else if (value instanceof Date) {
          result[key] = value.toISOString();
        }
        // Handle arrays and nested objects
        else if (Array.isArray(value)) {
          result[key] = value.map(item =>
            typeof item === 'object' && item !== null && 'toJSON' in item ? item.toJSON() : item
          );
        }
        // Handle nested objects with toJSON method
        else if (
          typeof value === 'object' &&
          value !== null &&
          'toJSON' in value &&
          typeof value.toJSON === 'function'
        ) {
          result[key] = value.toJSON();
        }
        // Handle all other values
        else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Default toObject implementation that calls toJSON
   * Provides backward compatibility for existing code
   */
  toObject(): Record<string, any> {
    return this.toJSON();
  }
}
