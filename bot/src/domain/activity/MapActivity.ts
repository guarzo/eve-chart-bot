/**
 * MapActivity domain entity
 * Represents a character's activity in mapping EVE Online space
 */
export class MapActivity {
  /** Character's EVE ID */
  readonly characterId: bigint;

  /** Timestamp of the activity */
  readonly timestamp: Date;

  /** Number of signatures scanned */
  signatures: number;

  /** Number of wormhole connections */
  connections: number;

  /** Number of wormhole passages */
  passages: number;

  /** Optional alliance ID */
  allianceId: number | null;

  /** Corporation ID */
  corporationId: number;

  /**
   * Create a new MapActivity instance
   *
   * @param props MapActivity properties
   */
  constructor(props: {
    characterId: bigint | string;
    timestamp: Date;
    signatures: number;
    connections: number;
    passages: number;
    corporationId: number;
    allianceId?: number | null;
  }) {
    // Convert string character ID to bigint if needed
    this.characterId =
      typeof props.characterId === "string"
        ? BigInt(props.characterId)
        : props.characterId;

    this.timestamp = props.timestamp;
    this.signatures = props.signatures;
    this.connections = props.connections;
    this.passages = props.passages;
    this.corporationId = props.corporationId;
    this.allianceId = props.allianceId ?? null;

    this.validate();
  }

  /**
   * Validate the map activity data
   * @throws Error if data is invalid
   */
  private validate(): void {
    if (!this.characterId) {
      throw new Error("Map activity must have a character ID");
    }

    if (!this.timestamp) {
      throw new Error("Map activity must have a timestamp");
    }

    if (this.signatures < 0) {
      throw new Error("Signatures count cannot be negative");
    }

    if (this.connections < 0) {
      throw new Error("Connections count cannot be negative");
    }

    if (this.passages < 0) {
      throw new Error("Passages count cannot be negative");
    }

    if (this.corporationId <= 0) {
      throw new Error("Map activity must have a valid corporation ID");
    }

    if (this.allianceId !== null && this.allianceId <= 0) {
      throw new Error("If alliance ID is provided, it must be valid");
    }
  }

  /**
   * Check if this activity entry represents any actual activity
   *
   * @returns True if there was activity, false if all counts are zero
   */
  hasActivity(): boolean {
    return this.signatures > 0 || this.connections > 0 || this.passages > 0;
  }

  /**
   * Calculate a composite activity score
   * Weighted to emphasize signature scanning
   *
   * @returns Numeric score reflecting overall activity
   */
  activityScore(): number {
    // Weight signatures more heavily as they represent more effort
    return this.signatures * 2 + this.connections + this.passages;
  }

  /**
   * Convert timestamp to local date string suitable for charting/grouping
   *
   * @param format Optional format (day|hour|raw)
   * @returns Formatted date string
   */
  getTimeKey(format: "day" | "hour" | "raw" = "day"): string {
    const date = this.timestamp;

    switch (format) {
      case "hour":
        return `${date.getFullYear()}-${
          date.getMonth() + 1
        }-${date.getDate()}-${date.getHours()}`;
      case "day":
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      case "raw":
      default:
        return this.timestamp.toISOString();
    }
  }

  /**
   * Convert domain entity to a plain object (useful for persistence)
   */
  toObject() {
    return {
      characterId: this.characterId,
      timestamp: this.timestamp,
      signatures: this.signatures,
      connections: this.connections,
      passages: this.passages,
      allianceId: this.allianceId,
      corporationId: this.corporationId,
    };
  }

  /**
   * Create a MapActivity domain entity from a database model
   *
   * @param model Database model object
   * @returns MapActivity domain entity
   */
  static fromModel(model: any): MapActivity {
    return new MapActivity({
      characterId: model.characterId,
      timestamp: model.timestamp,
      signatures: model.signatures,
      connections: model.connections,
      passages: model.passages,
      allianceId: model.allianceId,
      corporationId: model.corporationId,
    });
  }
}
