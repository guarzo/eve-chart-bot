/**
 * KillFact domain entity
 * Represents a character's kill in EVE Online
 */
export class KillFact {
  /** Killmail ID from EVE Online */
  readonly killmailId: bigint;

  /** Character EVE ID */
  readonly characterId: bigint;

  /** Timestamp of the kill */
  readonly killTime: Date;

  /** Whether the kill was on an NPC */
  npc: boolean;

  /** Whether the kill was solo (no other players on killmail) */
  solo: boolean;

  /** Whether the kill was on a player in the same alliance/corp (awox) */
  awox: boolean;

  /** Ship type ID of the ship the character was flying */
  shipTypeId: number;

  /** Solar system ID where the kill occurred */
  systemId: number;

  /** Labels or tags applied to this kill */
  labels: string[];

  /** Total ISK value of the kill */
  totalValue: bigint;

  /** Points awarded for the kill */
  points: number;

  /** Attackers participating in the kill (populated on demand) */
  private _attackers: KillAttacker[] | null = null;

  /** Victim information (populated on demand) */
  private _victim: KillVictim | null = null;

  /**
   * Create a new KillFact instance
   */
  constructor(props: {
    killmailId: bigint | string;
    characterId: bigint | string;
    killTime: Date;
    npc: boolean;
    solo: boolean;
    awox: boolean;
    shipTypeId: number;
    systemId: number;
    labels: string[];
    totalValue: bigint | string;
    points: number;
    attackers?: KillAttacker[];
    victim?: KillVictim;
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
    this.npc = props.npc;
    this.solo = props.solo;
    this.awox = props.awox;
    this.shipTypeId = props.shipTypeId;
    this.systemId = props.systemId;
    this.labels = props.labels || [];

    this.totalValue =
      typeof props.totalValue === "string"
        ? BigInt(props.totalValue)
        : props.totalValue;

    this.points = props.points;

    if (props.attackers) {
      this._attackers = props.attackers;
    }

    if (props.victim) {
      this._victim = props.victim;
    }

    this.validate();
  }

  /**
   * Validate the kill fact data
   * @throws Error if data is invalid
   */
  private validate(): void {
    if (!this.killmailId) {
      throw new Error("KillFact must have a killmail ID");
    }

    if (!this.characterId) {
      throw new Error("KillFact must have a character ID");
    }

    if (!this.killTime) {
      throw new Error("KillFact must have a kill time");
    }

    if (this.shipTypeId <= 0) {
      throw new Error("KillFact must have a valid ship type ID");
    }

    if (this.systemId <= 0) {
      throw new Error("KillFact must have a valid system ID");
    }

    if (this.points < 0) {
      throw new Error("KillFact points cannot be negative");
    }
  }

  /**
   * Get the attackers for this kill
   */
  get attackers(): KillAttacker[] {
    if (!this._attackers) {
      throw new Error("Attackers not loaded for this kill");
    }
    return this._attackers;
  }

  /**
   * Set the attackers for this kill
   */
  set attackers(attackers: KillAttacker[]) {
    this._attackers = attackers;
  }

  /**
   * Get the victim for this kill
   */
  get victim(): KillVictim {
    if (!this._victim) {
      throw new Error("Victim not loaded for this kill");
    }
    return this._victim;
  }

  /**
   * Set the victim for this kill
   */
  set victim(victim: KillVictim) {
    this._victim = victim;
  }

  /**
   * Check if attackers are loaded for this kill
   */
  get hasAttackers(): boolean {
    return this._attackers !== null;
  }

  /**
   * Check if victim is loaded for this kill
   */
  get hasVictim(): boolean {
    return this._victim !== null;
  }

  /**
   * Get the number of attackers on the killmail
   * @throws Error if attackers are not loaded
   */
  get attackerCount(): number {
    if (!this._attackers) {
      throw new Error("Attackers not loaded for this kill");
    }
    return this._attackers.length;
  }

  /**
   * Get the actual solo status (if attackers are loaded)
   * This may be different from the solo field which could be set during import
   */
  get actualSolo(): boolean {
    // If attackers aren't loaded, we can't determine the real solo status
    if (!this._attackers) {
      return this.solo;
    }

    // Solo means only one attacker (the character)
    return (
      this._attackers.length === 1 &&
      this._attackers[0].characterId === this.characterId
    );
  }

  /**
   * Get the ISK value in millions (more readable)
   */
  get iskValueMillions(): number {
    return Number(this.totalValue) / 1000000;
  }

  /**
   * Add a label to this kill
   */
  addLabel(label: string): void {
    if (!this.labels.includes(label)) {
      this.labels.push(label);
    }
  }

  /**
   * Remove a label from this kill
   */
  removeLabel(label: string): void {
    const index = this.labels.indexOf(label);
    if (index >= 0) {
      this.labels.splice(index, 1);
    }
  }

  /**
   * Check if this kill has a specific label
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
      npc: this.npc,
      solo: this.solo,
      awox: this.awox,
      shipTypeId: this.shipTypeId,
      systemId: this.systemId,
      labels: this.labels,
      totalValue: this.totalValue,
      points: this.points,
    };
  }

  /**
   * Create a KillFact domain entity from a database model
   */
  static fromModel(model: any, attackers?: any[], victim?: any): KillFact {
    const killFact = new KillFact({
      killmailId: model.killmail_id,
      characterId: model.character_id,
      killTime: model.kill_time,
      npc: model.npc,
      solo: model.solo,
      awox: model.awox,
      shipTypeId: model.ship_type_id,
      systemId: model.system_id,
      labels: model.labels || [],
      totalValue: model.total_value,
      points: model.points,
    });

    if (attackers) {
      killFact.attackers = attackers.map((a) => KillAttacker.fromModel(a));
    }

    if (victim) {
      killFact.victim = KillVictim.fromModel(victim);
    }

    return killFact;
  }
}

/**
 * KillAttacker domain entity
 * Represents an attacker on a killmail
 */
export class KillAttacker {
  /** Unique ID in the database */
  readonly id?: number;

  /** Killmail ID this attacker is associated with */
  readonly killmailId: bigint;

  /** Character ID (optional - could be NPC) */
  readonly characterId: bigint | null;

  /** Corporation ID */
  readonly corporationId: bigint | null;

  /** Alliance ID (optional) */
  readonly allianceId: bigint | null;

  /** Damage done by this attacker */
  readonly damageDone: number;

  /** Whether this attacker got the final blow */
  readonly finalBlow: boolean;

  /** Security status of the attacker */
  readonly securityStatus: number | null;

  /** Ship type ID */
  readonly shipTypeId: number | null;

  /** Weapon type ID */
  readonly weaponTypeId: number | null;

  constructor(props: {
    id?: number;
    killmailId: bigint | string;
    characterId?: bigint | string | null;
    corporationId?: bigint | string | null;
    allianceId?: bigint | string | null;
    damageDone: number;
    finalBlow: boolean;
    securityStatus?: number | null;
    shipTypeId?: number | null;
    weaponTypeId?: number | null;
  }) {
    this.id = props.id;

    // Convert string IDs to bigint if needed
    this.killmailId =
      typeof props.killmailId === "string"
        ? BigInt(props.killmailId)
        : props.killmailId;

    this.characterId =
      props.characterId === null || props.characterId === undefined
        ? null
        : typeof props.characterId === "string"
        ? BigInt(props.characterId)
        : props.characterId;

    this.corporationId =
      props.corporationId === null || props.corporationId === undefined
        ? null
        : typeof props.corporationId === "string"
        ? BigInt(props.corporationId)
        : props.corporationId;

    this.allianceId =
      props.allianceId === null || props.allianceId === undefined
        ? null
        : typeof props.allianceId === "string"
        ? BigInt(props.allianceId)
        : props.allianceId;

    this.damageDone = props.damageDone;
    this.finalBlow = props.finalBlow;
    this.securityStatus = props.securityStatus ?? null;
    this.shipTypeId = props.shipTypeId ?? null;
    this.weaponTypeId = props.weaponTypeId ?? null;
  }

  /**
   * Check if this attacker is an NPC
   */
  get isNpc(): boolean {
    return this.characterId === null;
  }

  /**
   * Convert to a plain object for persistence
   */
  toObject() {
    return {
      id: this.id,
      killmailId: this.killmailId,
      characterId: this.characterId,
      corporationId: this.corporationId,
      allianceId: this.allianceId,
      damageDone: this.damageDone,
      finalBlow: this.finalBlow,
      securityStatus: this.securityStatus,
      shipTypeId: this.shipTypeId,
      weaponTypeId: this.weaponTypeId,
    };
  }

  /**
   * Create a KillAttacker domain entity from a database model
   */
  static fromModel(model: any): KillAttacker {
    return new KillAttacker({
      id: model.id,
      killmailId: model.killmail_id,
      characterId: model.character_id,
      corporationId: model.corporation_id,
      allianceId: model.alliance_id,
      damageDone: model.damage_done,
      finalBlow: model.final_blow,
      securityStatus: model.security_status,
      shipTypeId: model.ship_type_id,
      weaponTypeId: model.weapon_type_id,
    });
  }
}

/**
 * KillVictim domain entity
 * Represents the victim on a killmail
 */
export class KillVictim {
  /** Unique ID in the database */
  readonly id: number;
  /** Killmail ID */
  readonly killmailId: bigint;
  /** Character ID if victim was a player */
  readonly characterId?: bigint;
  /** Corporation ID */
  readonly corporationId?: bigint;
  /** Alliance ID if victim was in an alliance */
  readonly allianceId?: bigint;
  /** Ship type ID */
  readonly shipTypeId: number;
  /** Amount of damage taken */
  readonly damageTaken: number;

  constructor(data: {
    id: number;
    killmailId: bigint;
    characterId?: bigint;
    corporationId?: bigint;
    allianceId?: bigint;
    shipTypeId: number;
    damageTaken: number;
  }) {
    this.id = data.id;
    this.killmailId = data.killmailId;
    this.characterId = data.characterId;
    this.corporationId = data.corporationId;
    this.allianceId = data.allianceId;
    this.shipTypeId = data.shipTypeId;
    this.damageTaken = data.damageTaken;
  }

  /**
   * Check if this victim is an NPC
   */
  get isNpc(): boolean {
    return this.characterId === null;
  }

  /**
   * Convert to a plain object for persistence
   */
  toObject() {
    return {
      id: this.id,
      killmailId: this.killmailId,
      characterId: this.characterId,
      corporationId: this.corporationId,
      allianceId: this.allianceId,
      shipTypeId: this.shipTypeId,
      damageTaken: this.damageTaken,
    };
  }

  /**
   * Create a KillVictim domain entity from a database model
   */
  static fromModel(model: any): KillVictim {
    return new KillVictim({
      id: model.id,
      killmailId: model.killmail_id,
      characterId: model.character_id,
      corporationId: model.corporation_id,
      allianceId: model.alliance_id,
      shipTypeId: model.ship_type_id,
      damageTaken: model.damage_taken,
    });
  }
}
