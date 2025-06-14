import { logger } from '../logger';

/**
 * Circuit breaker implementation for handling failure detection and recovery
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private _isOpen = false;

  /**
   * Create a new circuit breaker
   * @param threshold Number of failures before opening the circuit
   * @param timeout Time in milliseconds before attempting to close the circuit
   */
  constructor(
    private readonly threshold: number,
    private readonly timeout: number
  ) {}

  /**
   * Check if the circuit is open
   */
  isOpen(): boolean {
    if (!this._isOpen) {
      return false;
    }

    // Check if we should try to close the circuit
    if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.timeout) {
      logger.info('Circuit breaker timeout reached, attempting to close');
      this._isOpen = false;
      this.failures = 0;
      return false;
    }

    return true;
  }

  /**
   * Record a successful operation
   */
  onSuccess(): void {
    this.failures = 0;
    this._isOpen = false;
    this.lastFailureTime = null;
  }

  /**
   * Record a failed operation
   */
  onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      logger.warn(`Circuit breaker opened after ${this.failures} failures (threshold: ${this.threshold})`);
      this._isOpen = true;
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState() {
    return {
      isOpen: this._isOpen,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      threshold: this.threshold,
      timeout: this.timeout,
    };
  }
}
