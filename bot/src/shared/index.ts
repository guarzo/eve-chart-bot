/**
 * Shared Kernel - Public API
 * Exports common types, utilities, and interfaces used across bounded contexts
 */

// Common types
export * from './types/common';

// DTOs
export * from './dto/external-api.dto';
export * from './dto/domain.dto';

// Mappers
export * from './mappers/dto.mapper';

// Error handling
export * from './errors';

// Validation utilities
export * from './validation';

// Performance utilities
export * from './performance';

// General utilities
export * from './utilities';

// Cache utilities
export * from './cache';

// Shared interfaces
export * from './interfaces/repository';