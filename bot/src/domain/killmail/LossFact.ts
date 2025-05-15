/**
 * LossFact domain entity
 * Represents a character's loss in EVE Online
 */
export class LossFact {
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

  /** Labels or tags applied to this loss */
  labels: string[];

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
    // Convert string IDs to bigint if needed
    this.killmailId =
      typeof props.killmailId === "string"
        ? BigInt(props.killmailId)
        : props.killmailId;

    this.characterId =
      typeof props.characterId === "string"
        ? BigInt(props.characterId)
        : props.characterId;

    this.killTime = props.killTime;
    this.shipTypeId = props.shipTypeId;
    this.systemId = props.systemId;

    this.totalValue =
      typeof props.totalValue === "string"
        ? BigInt(props.totalValue)
        : props.totalValue;

    this.attackerCount = props.attackerCount;
    this.labels = props.labels || [];

    this.validate();
  }

  /**
   * Validate the loss fact data
   * @throws Error if data is invalid
   */
  private validate(): void {
    if (!this.killmailId) {
      throw new Error("LossFact must have a killmail ID");
    }

    if (!this.characterId) {
      throw new Error("LossFact must have a character ID");
    }

    if (!this.killTime) {
      throw new Error("LossFact must have a kill time");
    }

    if (this.shipTypeId <= 0) {
      throw new Error("LossFact must have a valid ship type ID");
    }

    if (this.systemId <= 0) {
      throw new Error("LossFact must have a valid system ID");
    }

    if (this.attackerCount < 0) {
      throw new Error("LossFact attacker count cannot be negative");
    }
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
  getLossCategory(): "cheap" | "moderate" | "expensive" | "blingy" {
    const valueMillions = this.iskValueMillions;

    if (valueMillions < 10) {
      return "cheap";
    } else if (valueMillions < 100) {
      return "moderate";
    } else if (valueMillions < 1000) {
      return "expensive";
    } else {
      return "blingy";
    }
  }

  /**
   * Add a label to this loss
   */
  addLabel(label: string): void {
    if (!this.labels.includes(label)) {
      this.labels.push(label);
    }
  }

  /**
   * Remove a label from this loss
   */
  removeLabel(label: string): void {
    const index = this.labels.indexOf(label);
    if (index >= 0) {
      this.labels.splice(index, 1);
    }
  }

  /**
   * Check if this loss has a specific label
   */
  hasLabel(label: string): boolean {
    return this.labels.includes(label);
  }

  /**
   * Convert to a plain object for persistence
   */
  toObject() {
    return {
      killmailId: this.killmailId,
      characterId: this.characterId,
      killTime: this.killTime,
      shipTypeId: this.shipTypeId,
      systemId: this.systemId,
      totalValue: this.totalValue,
      attackerCount: this.attackerCount,
      labels: this.labels,
    };
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
      labels: model.labels || [],
    });
  }
}
