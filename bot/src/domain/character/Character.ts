/**
 * Character domain entity
 * Represents an EVE Online character with core game attributes and application-specific business logic
 */
export class Character {
  /** EVE character ID (unique identifier) */
  readonly eveId: string;

  /** Character name */
  name: string;

  /** Alliance ID (optional, as character might not be in an alliance) */
  allianceId: number | null;

  /** Alliance ticker (optional) */
  allianceTicker: string | null;

  /** Corporation ID (all characters must be in a corporation) */
  corporationId: number;

  /** Corporation ticker */
  corporationTicker: string;

  /** Whether this character is designated as a "main" character */
  isMain: boolean;

  /** Optional link to character group ID */
  characterGroupId: string | null;

  /** Optional link to main character ID */
  mainCharacterId: string | null;

  /** Last time backfill was run for this character */
  lastBackfillAt: Date | null;

  /**
   * Create a new Character instance
   *
   * @param props Character properties
   */
  constructor(props: {
    eveId: string;
    name: string;
    corporationId: number;
    corporationTicker: string;
    allianceId?: number | null;
    allianceTicker?: string | null;
    isMain?: boolean;
    characterGroupId?: string | null;
    mainCharacterId?: string | null;
    lastBackfillAt?: Date | null;
  }) {
    // Required properties
    this.eveId = props.eveId;
    this.name = props.name;
    this.corporationId = props.corporationId;
    this.corporationTicker = props.corporationTicker;

    // Optional properties with defaults
    this.allianceId = props.allianceId || null;
    this.allianceTicker = props.allianceTicker || null;
    this.isMain = props.isMain ?? false;
    this.characterGroupId = props.characterGroupId || null;
    this.mainCharacterId = props.mainCharacterId || null;
    this.lastBackfillAt = props.lastBackfillAt || null;

    // Validate the character
    this.validate();
  }

  /**
   * Validate the character data
   * @throws Error if character data is invalid
   */
  private validate(): void {
    if (!this.eveId || isNaN(parseInt(this.eveId))) {
      throw new Error("Character must have a valid EVE ID");
    }

    if (!this.name || this.name.trim() === "") {
      throw new Error("Character must have a name");
    }

    if (!this.corporationId || this.corporationId <= 0) {
      throw new Error("Character must have a valid corporation ID");
    }

    if (!this.corporationTicker || this.corporationTicker.trim() === "") {
      throw new Error("Character must have a corporation ticker");
    }

    // Validate alliance data if present
    if (this.allianceId !== null && this.allianceId <= 0) {
      throw new Error("If alliance ID is provided, it must be valid");
    }
  }

  /**
   * Set this character as the main character
   */
  setAsMain(): void {
    this.isMain = true;
    this.mainCharacterId = null; // A main character cannot have a main character
  }

  /**
   * Set this character as an alt of another character
   *
   * @param mainCharacterId The EVE ID of the main character
   * @throws Error if trying to set character as alt of itself
   */
  setAsAltOf(mainCharacterId: string): void {
    if (this.eveId === mainCharacterId) {
      throw new Error("Character cannot be an alt of itself");
    }

    this.isMain = false;
    this.mainCharacterId = mainCharacterId;
  }

  /**
   * Set this character's group
   *
   * @param groupId The character group ID
   */
  setGroup(groupId: string | null): void {
    this.characterGroupId = groupId;
  }

  /**
   * Update the lastBackfillAt timestamp to now
   */
  updateBackfillTimestamp(): void {
    this.lastBackfillAt = new Date();
  }

  /**
   * Check if backfill is needed based on days since last backfill
   *
   * @param maxAgeDays Maximum age in days before backfill is needed
   * @returns True if backfill is needed, false otherwise
   */
  needsBackfill(maxAgeDays: number = 7): boolean {
    if (!this.lastBackfillAt) {
      return true;
    }

    const now = new Date();
    const ageInMs = now.getTime() - this.lastBackfillAt.getTime();
    const ageInDays = ageInMs / (1000 * 60 * 60 * 24);

    return ageInDays > maxAgeDays;
  }

  /**
   * Get character's affiliation string (corp ticker and alliance ticker if available)
   *
   * @returns Formatted affiliation string
   */
  getAffiliation(): string {
    if (this.allianceTicker) {
      return `[${this.corporationTicker}] <${this.allianceTicker}>`;
    }
    return `[${this.corporationTicker}]`;
  }

  /**
   * Convert domain entity to a plain object (useful for persistence)
   */
  toObject() {
    return {
      eveId: this.eveId,
      name: this.name,
      allianceId: this.allianceId,
      allianceTicker: this.allianceTicker,
      corporationId: this.corporationId,
      corporationTicker: this.corporationTicker,
      isMain: this.isMain,
      characterGroupId: this.characterGroupId,
      mainCharacterId: this.mainCharacterId,
      lastBackfillAt: this.lastBackfillAt,
    };
  }

  /**
   * Create a Character domain entity from a database model
   *
   * @param model Database model object
   * @returns Character domain entity
   */
  static fromModel(model: any): Character {
    return new Character({
      eveId: model.eveId,
      name: model.name,
      allianceId: model.allianceId,
      allianceTicker: model.allianceTicker,
      corporationId: model.corporationId,
      corporationTicker: model.corporationTicker,
      isMain: model.isMain,
      characterGroupId: model.characterGroupId,
      mainCharacterId: model.mainCharacterId,
      lastBackfillAt: model.lastBackfillAt,
    });
  }
}
