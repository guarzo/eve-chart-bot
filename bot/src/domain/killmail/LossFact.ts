import { BaseEntity } from '../BaseEntity';
import { ensureRequiredBigInt } from '../../utils/conversion';
import { validateRequired, validatePositive, validateNonNegative } from '../../utils/validation';

/**
 * LossFact domain entity
 * Represents a character's loss in EVE Online
 */
export class LossFact extends BaseEntity {
  /** Killmail ID from EVE Online */
  readonly killmailId: bigint;

  /** Character EVE ID (who lost the ship) */
  readonly characterId: bigint;

  /** Timestamp of the loss */
  readonly killTime: Date;

  /** Ship type ID of the ship that was lost */
  shipTypeId: number;

  /** Solar system ID where the loss occurred */
  systemId: number;

  /** Total ISK value of the loss */
  totalValue: bigint;

  /** Number of attackers on the killmail */
  attackerCount: number;

  // Labels are inherited from BaseEntity

  /**
   * Create a new LossFact instance
   */
  constructor(props: {
    killmailId: bigint | string;
    characterId: bigint | string;
    killTime: Date;
    shipTypeId: number;
    systemId: number;
    totalValue: bigint | string;
    attackerCount: number;
    labels?: string[];
  }) {
    super();

    // Convert string IDs to bigint using utility
    this.killmailId = ensureRequiredBigInt(props.killmailId);
    this.characterId = ensureRequiredBigInt(props.characterId);

    this.killTime = props.killTime;
    this.shipTypeId = props.shipTypeId;
    this.systemId = props.systemId;
    this.totalValue = ensureRequiredBigInt(props.totalValue);
    this.attackerCount = props.attackerCount;
    this.labels = props.labels ?? [];

    this.validate();
  }

  /**
   * Validate the loss fact data using shared validation utilities
   * @throws Error if data is invalid
   */
  private validate(): void {
    validateRequired('killmailId', this.killmailId);
    validateRequired('characterId', this.characterId);
    validateRequired('killTime', this.killTime);
    validatePositive('shipTypeId', this.shipTypeId);
    validatePositive('systemId', this.systemId);
    validateNonNegative('attackerCount', this.attackerCount);
  }

  /**
   * Check if loss was a solo kill (by a single attacker)
   */
  get wasSoloKill(): boolean {
    return this.attackerCount === 1;
  }

  /**
   * Check if loss was a "gank" (multiple attackers)
   */
  get wasGanked(): boolean {
    return this.attackerCount > 1;
  }

  /**
   * Get the ISK value in millions (more readable)
   */
  get iskValueMillions(): number {
    return Number(this.totalValue) / 1000000;
  }

  /**
   * Get the loss type category based on ISK value
   * @returns 'cheap', 'moderate', 'expensive', or 'blingy'
   */
  getLossCategory(): 'cheap' | 'moderate' | 'expensive' | 'blingy' {
    const valueMillions = this.iskValueMillions;

    if (valueMillions < 10) {
      return 'cheap';
    } else if (valueMillions < 100) {
      return 'moderate';
    } else if (valueMillions < 1000) {
      return 'expensive';
    } else {
      return 'blingy';
    }
  }

  /**
   * Create a LossFact domain entity from a database model
   */
  static fromModel(model: any): LossFact {
    return new LossFact({
      killmailId: model.killmail_id,
      characterId: model.character_id,
      killTime: model.kill_time,
      shipTypeId: model.ship_type_id,
      systemId: model.system_id,
      totalValue: model.total_value,
      attackerCount: model.attacker_count,
      labels: model.labels ?? [],
    });
  }
}
