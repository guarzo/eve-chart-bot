import { BigIntTransformer } from './BigIntTransformer';

/**
 * Helper utilities for migrating from scattered BigInt patterns to centralized transformer
 */
export class BigIntMigrationHelper {
  /**
   * Common migration patterns and their replacements
   */
  static readonly MIGRATION_PATTERNS = {
    // Pattern: group.characters.map(c => BigInt(c.eveId))
    legacyCharacterIdMapping: (characters: { eveId: unknown }[]): bigint[] => {
      console.warn('DEPRECATED: Use BigIntTransformer.migrateCharacterIds() instead');
      return BigIntTransformer.migrateCharacterIds(characters);
    },

    // Pattern: killFact.killmail_id.toString()
    legacyToString: (value: bigint | null | undefined): string => {
      console.warn('DEPRECATED: Use BigIntTransformer.forLogging() instead');
      return BigIntTransformer.forLogging(value);
    },

    // Pattern: characterIds.map(id => id.toString())
    legacyArrayToString: (values: bigint[]): string[] => {
      console.warn('DEPRECATED: Use BigIntTransformer.arrayToStringArray() instead');
      return BigIntTransformer.arrayToStringArray(values);
    },

    // Pattern: BigInt(value) with manual error handling
    legacyConversion: (value: unknown): bigint | null => {
      console.warn('DEPRECATED: Use BigIntTransformer.toBigInt() instead');
      return BigIntTransformer.migrateFromLegacyPattern(value);
    },
  };

  /**
   * Scan code for common BigInt anti-patterns
   */
  static analyzeCodePatterns(codeString: string): {
    legacyPatterns: string[];
    recommendedReplacements: string[];
  } {
    const patterns = [
      {
        pattern: /BigInt\([^)]+\)/g,
        replacement: 'BigIntTransformer.toBigInt()',
        description: 'Direct BigInt() calls should use transformer'
      },
      {
        pattern: /\.toString\(\)/g,
        replacement: 'BigIntTransformer.forLogging()',
        description: 'BigInt toString() for logging should use transformer'
      },
      {
        pattern: /\.map\(.*BigInt\(/g,
        replacement: 'BigIntTransformer.arrayToBigIntArray()',
        description: 'Array mapping with BigInt should use transformer'
      },
      {
        pattern: /characters\.map\(.*eveId.*\)/g,
        replacement: 'BigIntTransformer.migrateCharacterIds()',
        description: 'Character ID mapping should use transformer'
      },
    ];

    const legacyPatterns: string[] = [];
    const recommendedReplacements: string[] = [];

    patterns.forEach(({ pattern, replacement, description }) => {
      const matches = codeString.match(pattern);
      if (matches) {
        legacyPatterns.push(`${description}: ${matches.length} occurrences`);
        recommendedReplacements.push(`Replace with: ${replacement}`);
      }
    });

    return { legacyPatterns, recommendedReplacements };
  }

  /**
   * Generate migration report for a file
   */
  static generateMigrationReport(filePath: string, codeContent: string): {
    filePath: string;
    needsMigration: boolean;
    patterns: ReturnType<typeof BigIntMigrationHelper.analyzeCodePatterns>;
    priority: 'high' | 'medium' | 'low';
  } {
    const patterns = this.analyzeCodePatterns(codeContent);
    const needsMigration = patterns.legacyPatterns.length > 0;
    
    // Determine priority based on number and type of patterns
    let priority: 'high' | 'medium' | 'low' = 'low';
    if (patterns.legacyPatterns.length > 10) {
      priority = 'high';
    } else if (patterns.legacyPatterns.length > 5) {
      priority = 'medium';
    }

    return {
      filePath,
      needsMigration,
      patterns,
      priority,
    };
  }

  /**
   * Common refactoring patterns for chart generators
   */
  static readonly CHART_GENERATOR_PATTERNS = {
    // Before: group.characters.map(c => BigInt(c.eveId))
    // After: BigIntTransformer.migrateCharacterIds(group.characters)
    refactorCharacterIdMapping: `
// ❌ Before (scattered pattern):
const characterIds = group.characters.map(c => BigInt(c.eveId));

// ✅ After (centralized):
const characterIds = BigIntTransformer.migrateCharacterIds(group.characters);
`,

    // Before: characterIds.map(id => id.toString())
    // After: BigIntTransformer.arrayToStringArray(characterIds)
    refactorLoggingArrays: `
// ❌ Before (manual mapping):
logger.info('Processing characters: ' + characterIds.map(id => id.toString()).join(', '));

// ✅ After (centralized):
logger.info('Processing characters: ' + BigIntTransformer.arrayToStringArray(characterIds).join(', '));
`,

    // Before: killFact.killmail_id.toString()
    // After: BigIntTransformer.forLogging(killFact.killmail_id)
    refactorLogging: `
// ❌ Before (manual toString):
logger.debug(\`Processing killmail \${killFact.killmail_id.toString()}\`);

// ✅ After (centralized):
logger.debug(\`Processing killmail \${BigIntTransformer.forLogging(killFact.killmail_id)}\`);
`,

    // Before: Manual BigInt conversion with try/catch
    // After: BigIntTransformer.toBigInt()
    refactorConversion: `
// ❌ Before (manual error handling):
let characterId: bigint;
try {
  characterId = BigInt(input);
} catch (error) {
  throw new Error(\`Invalid character ID: \${input}\`);
}

// ✅ After (centralized):
const characterId = BigIntTransformer.toRequiredBigInt(input);
`,
  };

  /**
   * Generate comprehensive migration guide
   */
  static generateMigrationGuide(): string {
    return `
# BigInt Transformation Migration Guide

## Overview
This guide helps migrate from scattered BigInt transformation patterns to the centralized BigIntTransformer.

## Common Migration Patterns

### 1. Character ID Mapping (Chart Generators)
${this.CHART_GENERATOR_PATTERNS.refactorCharacterIdMapping}

### 2. Logging Arrays
${this.CHART_GENERATOR_PATTERNS.refactorLoggingArrays}

### 3. Single Value Logging
${this.CHART_GENERATOR_PATTERNS.refactorLogging}

### 4. Conversion with Error Handling
${this.CHART_GENERATOR_PATTERNS.refactorConversion}

## Class-Transformer Decorators

### Before (duplicated decorators):
\`\`\`typescript
@Transform(({ value }) => value?.toString())
readonly killmailId!: bigint;

@Transform(({ value }) => value?.toString())
readonly characterId?: bigint;
\`\`\`

### After (centralized decorators):
\`\`\`typescript
@BigIntTransformer.requiredStringTransform
readonly killmailId!: bigint;

@BigIntTransformer.stringTransform
readonly characterId?: bigint;
\`\`\`

## Zod Schemas

### Before (custom schemas):
\`\`\`typescript
const CustomBigIntSchema = z.union([
  z.bigint(),
  z.string().transform(val => BigInt(val)),
  z.number().transform(val => BigInt(Math.floor(val))),
]);
\`\`\`

### After (standardized schemas):
\`\`\`typescript
const schema = BigIntTransformer.zodRequiredSchema;
const eveIdSchema = BigIntTransformer.zodEveIdSchema;
\`\`\`

## Migration Checklist

- [ ] Replace direct BigInt() calls with BigIntTransformer.toBigInt()
- [ ] Replace manual toString() with BigIntTransformer.forLogging()
- [ ] Replace character ID mapping with BigIntTransformer.migrateCharacterIds()
- [ ] Replace custom decorators with BigIntTransformer decorators
- [ ] Replace custom Zod schemas with BigIntTransformer schemas
- [ ] Update logging statements to use centralized formatters
- [ ] Add validation using BigIntTransformer.isValidEveId()

## Benefits After Migration

1. **Consistency**: All BigInt transformations use the same patterns
2. **Error Handling**: Centralized error handling and validation
3. **Performance**: Optimized conversion algorithms
4. **Maintainability**: Single location for BigInt transformation logic
5. **Type Safety**: Better TypeScript integration and validation
`;
  }
}