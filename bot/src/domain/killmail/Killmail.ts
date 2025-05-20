import { Exclude, Expose, Transform } from "class-transformer";

/**
 * Killmail victim domain entity
 */
@Exclude()
export class KillmailVictim {
  @Expose()
  @Transform(({ value }) => value?.toString())
  readonly characterId?: bigint;

  @Expose()
  @Transform(({ value }) => value?.toString())
  readonly corporationId?: bigint;

  @Expose()
  @Transform(({ value }) => value?.toString())
  readonly allianceId?: bigint;

  @Expose()
  readonly shipTypeId!: number;

  @Expose()
  readonly damageTaken!: number;

  constructor(data: Partial<KillmailVictim>) {
    Object.assign(this, data);
  }

  /**
   * Creates a new KillmailVictim instance from a Prisma model
   */
  static fromPrisma(model: any): KillmailVictim {
    return new KillmailVictim({
      characterId: model.characterId,
      corporationId: model.corporationId,
      allianceId: model.allianceId,
      shipTypeId: model.shipTypeId,
      damageTaken: model.damageTaken,
    });
  }

  /**
   * Converts the victim to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      characterId: this.characterId?.toString(),
      corporationId: this.corporationId?.toString(),
      allianceId: this.allianceId?.toString(),
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
  @Transform(({ value }) => value?.toString())
  readonly characterId?: bigint;

  @Expose()
  @Transform(({ value }) => value?.toString())
  readonly corporationId?: bigint;

  @Expose()
  @Transform(({ value }) => value?.toString())
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
   * Creates a new KillmailAttacker instance from a Prisma model
   */
  static fromPrisma(model: any): KillmailAttacker {
    return new KillmailAttacker({
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

  /**
   * Converts the attacker to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      characterId: this.characterId?.toString(),
      corporationId: this.corporationId?.toString(),
      allianceId: this.allianceId?.toString(),
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
  @Transform(({ value }) => value.toString())
  readonly killmailId!: bigint;

  @Expose()
  @Transform(({ value }) => value.toISOString())
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
  @Transform(({ value }) => value.toString())
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
   * Creates a new Killmail instance from a Prisma model
   */
  static fromPrisma(model: any): Killmail {
    return new Killmail({
      killmailId: model.killmailId,
      killTime: model.killTime,
      npc: model.npc,
      solo: model.solo,
      awox: model.awox,
      shipTypeId: model.shipTypeId,
      systemId: model.systemId,
      labels: model.labels,
      totalValue: model.totalValue,
      points: model.points,
      attackers: model.attackers?.map((a: any) =>
        KillmailAttacker.fromPrisma(a)
      ),
      victim: model.victim
        ? KillmailVictim.fromPrisma(model.victim)
        : undefined,
    });
  }

  /**
   * Converts the killmail to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      killmailId: this.killmailId.toString(),
      killTime: this.killTime.toISOString(),
      npc: this.npc,
      solo: this.solo,
      awox: this.awox,
      shipTypeId: this.shipTypeId,
      systemId: this.systemId,
      labels: this.labels,
      totalValue: this.totalValue.toString(),
      points: this.points,
      attackers: this.attackers?.map((a) => a.toJSON()),
      victim: this.victim?.toJSON(),
    };
  }
}
