/**
 * Shared Kernel - Public API
 * Exports common types, utilities, and interfaces used across bounded contexts
 */

// Common types
export * from './types/common';
export * from './types';

// Enums
export * from './enums';

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

// HTTP utilities
export * from './http';

// API response schemas
export {
  ZkillResponseSchema,
  ESICharacterSchema,
  ESICorporationSchema,
  ESIAllianceSchema,
  MapActivityDataSchema,
  UserCharacterGroupSchema,
  HttpResponseSchema,
  PaginationMetaSchema,
  WebSocketMessageSchema,
  WebSocketKillmailMessageSchema,
  // Export specific types to avoid conflicts
  type ZkillResponse,
  type ESICharacter,
  type ESICorporation,
  type ESIAlliance,
  type HttpResponse,
  type WebSocketMessage as WSMessage,
} from './schemas/api-responses';

// Shared interfaces
export * from './interfaces/repository';
