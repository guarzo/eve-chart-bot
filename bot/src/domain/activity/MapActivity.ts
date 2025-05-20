/**
 * MapActivity domain entity
 * Represents a character's activity in mapping EVE Online space
 */
export class MapActivity {
  /** Character's EVE ID */
  readonly characterId: bigint;

  /** Timestamp of the activity */
  readonly timestamp: Date;

  /** Number of signatures found */
  readonly signatures: number;

  /** Number of connections made */
  readonly connections: number;

  /** Number of passages through systems */
  readonly passages: number;

  /** Alliance ID if character is in an alliance */
  readonly allianceId: number | null;

  /** Corporation ID */
  readonly corporationId: number;

  /**
   * Create a new MapActivity instance
   *
   * @param data MapActivity properties
   */
  constructor(data: {
    characterId: bigint;
    timestamp: Date;
    signatures: number;
    connections: number;
    passages: number;
    allianceId?: number | null;
    corporationId: number;
  }) {
    this.characterId = data.characterId;
    this.timestamp = data.timestamp;
    this.signatures = data.signatures;
    this.connections = data.connections;
    this.passages = data.passages;
    this.allianceId = data.allianceId ?? null;
    this.corporationId = data.corporationId;

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
}
