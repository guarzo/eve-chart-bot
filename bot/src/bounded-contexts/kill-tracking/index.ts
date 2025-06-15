/**
 * Kill Tracking Bounded Context - Public API
 * Exports entities and repositories for kill/loss tracking
 */

// Domain entities
export * from './domain/entities/KillFact';
export * from './domain/entities/LossFact';
export * from './domain/entities/Killmail';

// Repository interfaces
export * from './domain/repositories/KillRepository';