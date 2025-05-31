import { ClassConstructor, plainToInstance } from "class-transformer";

/**
 * Generic mapper for converting between Prisma models and domain entities
 */
export class PrismaMapper {
  /**
   * Converts snake_case to camelCase
   */
  private static toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
  }

  /**
   * Recursively converts an object's keys from snake_case to camelCase
   */
  private static convertKeysToCamelCase(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertKeysToCamelCase(item));
    }

    if (typeof obj === "object" && obj.constructor === Object) {
      const converted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const camelKey = this.toCamelCase(key);
        converted[camelKey] = this.convertKeysToCamelCase(value);
      }
      return converted;
    }

    return obj;
  }

  /**
   * Maps a Prisma model to a domain entity
   * @param model The Prisma model instance
   * @param EntityClass The domain entity class constructor
   * @returns A new instance of the domain entity
   */
  static map<T>(model: any, EntityClass: ClassConstructor<T>): T {
    // Convert snake_case keys to camelCase before mapping
    const convertedModel = this.convertKeysToCamelCase(model);

    return plainToInstance(EntityClass, convertedModel, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Maps an array of Prisma models to domain entities
   * @param models Array of Prisma model instances
   * @param EntityClass The domain entity class constructor
   * @returns Array of domain entity instances
   */
  static mapArray<T>(models: any[], EntityClass: ClassConstructor<T>): T[] {
    return models.map((model) => this.map(model, EntityClass));
  }

  /**
   * Maps a Prisma model to a plain object, excluding Prisma-specific fields
   * @param model The Prisma model instance
   * @returns A plain object representation
   */
  static toPlainObject(model: any): Record<string, any> {
    const result: Record<string, any> = {};

    // Skip Prisma-specific fields
    const skipFields = ["$type", "$parent", "$path", "$args"];

    for (const [key, value] of Object.entries(model)) {
      if (!skipFields.includes(key)) {
        result[key] = value;
      }
    }

    return result;
  }
}
