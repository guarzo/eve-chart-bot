import { Exclude, Expose, Transform } from 'class-transformer';
import { BigIntTransformer } from '../../shared/utilities/BigIntTransformer';

/**
 * Killmail victim domain entity
 */
@Exclude()
export class KillmailVictim {
  @Expose()
  @BigIntTransformer.stringTransform
  readonly characterId?: bigint;

  @Expose()
  @BigIntTransformer.stringTransform
  readonly corporationId?: bigint;

  @Expose()
  @BigIntTransformer.stringTransform
  readonly allianceId?: bigint;

  @Expose()
  readonly shipTypeId!: number;

  @Expose()
  readonly damageTaken!: number;

  constructor(data: Partial<KillmailVictim>) {
    Object.assign(this, data);
  }

  /**
   * Converts the victim to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      characterId: BigIntTransformer.forJson(this.characterId),
      corporationId: BigIntTransformer.forJson(this.corporationId),
      allianceId: BigIntTransformer.forJson(this.allianceId),
      shipTypeId: this.shipTypeId,
      damageTaken: this.damageTaken,
    };
  }
}

/**
 * Killmail attacker domain entity
 */
@Exclude()
export class KillmailAttacker {
  @Expose()
  @BigIntTransformer.stringTransform
  readonly characterId?: bigint;

  @Expose()
  @BigIntTransformer.stringTransform
  readonly corporationId?: bigint;

  @Expose()
  @BigIntTransformer.stringTransform
  readonly allianceId?: bigint;

  @Expose()
  readonly damageDone!: number;

  @Expose()
  readonly finalBlow!: boolean;

  @Expose()
  readonly securityStatus?: number;

  @Expose()
  readonly shipTypeId?: number;

  @Expose()
  readonly weaponTypeId?: number;

  constructor(data: Partial<KillmailAttacker>) {
    Object.assign(this, data);
  }

  /**
   * Converts the attacker to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      characterId: BigIntTransformer.forJson(this.characterId),
      corporationId: BigIntTransformer.forJson(this.corporationId),
      allianceId: BigIntTransformer.forJson(this.allianceId),
      damageDone: this.damageDone,
      finalBlow: this.finalBlow,
      securityStatus: this.securityStatus,
      shipTypeId: this.shipTypeId,
      weaponTypeId: this.weaponTypeId,
    };
  }
}

/**
 * Killmail domain entity
 * Represents a killmail in EVE Online
 */
@Exclude()
export class Killmail {
  @Expose()
  @BigIntTransformer.requiredStringTransform
  readonly killmailId!: bigint;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  readonly killTime!: Date;

  @Expose()
  readonly npc!: boolean;

  @Expose()
  readonly solo!: boolean;

  @Expose()
  readonly awox!: boolean;

  @Expose()
  readonly shipTypeId!: number;

  @Expose()
  readonly systemId!: number;

  @Expose()
  readonly labels!: string[];

  @Expose()
  @BigIntTransformer.requiredStringTransform
  readonly totalValue!: bigint;

  @Expose()
  readonly points!: number;

  @Expose()
  readonly attackers?: KillmailAttacker[];

  @Expose()
  readonly victim?: KillmailVictim;

  constructor(data: Partial<Killmail>) {
    Object.assign(this, data);
  }

  /**
   * Converts the killmail to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      killmailId: this.killmailId?.toString() ?? '',
      killTime: this.killTime?.toISOString() ?? new Date().toISOString(),
      npc: this.npc,
      solo: this.solo,
      awox: this.awox,
      shipTypeId: this.shipTypeId,
      systemId: this.systemId,
      labels: this.labels,
      totalValue: this.totalValue?.toString() ?? '0',
      points: this.points,
      attackers: this.attackers?.map(a => a.toJSON()),
      victim: this.victim?.toJSON(),
    };
  }
}
