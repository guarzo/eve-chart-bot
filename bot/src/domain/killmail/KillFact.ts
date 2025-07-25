import { BaseEntity } from '../BaseEntity';
import { ensureRequiredBigInt, ensureBigInt } from '../../shared/utilities/conversion';
import { validateRequired, validatePositive, validateNonNegative } from '../../shared/validation/validation';

/**
 * KillFact domain entity
 * Represents a character's kill in EVE Online
 */
export class KillFact extends BaseEntity {
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

  // Labels are inherited from BaseEntity

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
    labels?: string[];
    totalValue: bigint | string;
    points: number;
    attackers?: KillAttacker[];
    victim?: KillVictim;
  }) {
    super();

    // Convert string IDs to bigint using utility
    this.killmailId = ensureRequiredBigInt(props.killmailId);
    this.characterId = ensureRequiredBigInt(props.characterId);

    this.killTime = props.killTime;
    this.npc = props.npc;
    this.solo = props.solo;
    this.awox = props.awox;
    this.shipTypeId = props.shipTypeId;
    this.systemId = props.systemId;
    // Set labels using the inherited property from BaseEntity
    this.labels = props.labels ?? [];
    this.totalValue = ensureRequiredBigInt(props.totalValue);
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
   * Validate the kill fact data using shared validation utilities
   * @throws Error if data is invalid
   */
  private validate(): void {
    validateRequired('killmailId', this.killmailId);
    validateRequired('characterId', this.characterId);
    validateRequired('killTime', this.killTime);
    validatePositive('shipTypeId', this.shipTypeId);
    validatePositive('systemId', this.systemId);
    validateNonNegative('points', this.points);
  }

  /**
   * Get the attackers for this kill (nullable return)
   * Returns null if attackers are not loaded
   */
  get attackers(): KillAttacker[] | null {
    return this._attackers;
  }

  /**
   * Get the attackers for this kill with safe access
   * Returns empty array if attackers are not loaded
   */
  getAttackersSafe(): KillAttacker[] {
    return this._attackers || [];
  }

  /**
   * Get loaded attackers or throw error if not loaded
   * Use this only when you're certain attackers should be loaded
   */
  getAttackersRequired(): KillAttacker[] {
    if (!this._attackers) {
      throw new Error('Attackers not loaded for this kill - ensure relations are included in query');
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
   * Get the victim for this kill (nullable return)
   * Returns null if victim is not loaded
   */
  get victim(): KillVictim | null {
    return this._victim;
  }

  /**
   * Get loaded victim or throw error if not loaded
   * Use this only when you're certain victim should be loaded
   */
  getVictimRequired(): KillVictim {
    if (!this._victim) {
      throw new Error('Victim not loaded for this kill - ensure relations are included in query');
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
   * Returns 0 if attackers are not loaded
   */
  get attackerCount(): number {
    return this._attackers?.length || 0;
  }

  /**
   * Get the exact number of attackers (requires attackers to be loaded)
   * @throws Error if attackers are not loaded
   */
  getAttackerCountRequired(): number {
    if (!this._attackers) {
      throw new Error('Attackers not loaded for this kill - ensure relations are included in query');
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
    return this._attackers.length === 1 && this._attackers[0].characterId === this.characterId;
  }

  /**
   * Get the ISK value in millions (more readable)
   */
  get iskValueMillions(): number {
    return Number(this.totalValue) / 1000000;
  }

  /**
   * Explicitly load attackers for this kill
   * This method should be used by repository layer to safely load relations
   */
  loadAttackers(attackers: KillAttacker[]): void {
    this._attackers = attackers;
  }

  /**
   * Explicitly load victim for this kill
   * This method should be used by repository layer to safely load relations
   */
  loadVictim(victim: KillVictim): void {
    this._victim = victim;
  }

  /**
   * Clear loaded relations (useful for memory management)
   */
  clearRelations(): void {
    this._attackers = null;
    this._victim = null;
  }

  /**
   * Check if all relations are loaded
   */
  areRelationsLoaded(): boolean {
    return this._attackers !== null && this._victim !== null;
  }

  /**
   * Create a KillFact domain entity from a database model
   */
  static fromModel(model: any, attackers?: any[], victim?: any): KillFact {
    const killFact = new KillFact({
      killmailId: model.killmailId,
      characterId: model.characterId,
      killTime: model.killTime,
      npc: model.npc,
      solo: model.solo,
      awox: model.awox,
      shipTypeId: model.shipTypeId,
      systemId: model.systemId,
      labels: model.labels ?? [],
      totalValue: model.totalValue,
      points: model.points,
    });

    if (attackers) {
      killFact.loadAttackers(attackers.map(a => KillAttacker.fromModel(a)));
    }

    if (victim) {
      killFact.loadVictim(KillVictim.fromModel(victim));
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

    // Convert string IDs to bigint using utility
    this.killmailId = ensureRequiredBigInt(props.killmailId);
    this.characterId = ensureBigInt(props.characterId);
    this.corporationId = ensureBigInt(props.corporationId);
    this.allianceId = ensureBigInt(props.allianceId);

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
      killmailId: model.killmailId,
      characterId: model.characterId,
      corporationId: model.corporationId,
      allianceId: model.allianceId,
      damageDone: model.damageDone,
      finalBlow: model.finalBlow,
      securityStatus: model.securityStatus,
      shipTypeId: model.shipTypeId,
      weaponTypeId: model.weaponTypeId,
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
      killmailId: model.killmailId,
      characterId: model.characterId,
      corporationId: model.corporationId,
      allianceId: model.allianceId,
      shipTypeId: model.shipTypeId,
      damageTaken: model.damageTaken,
    });
  }
}
