import { Exclude, Expose, Transform } from 'class-transformer';
import { BigIntTransformer } from '../../shared/utilities/BigIntTransformer';

/**
 * Character domain entity
 * Represents a character in EVE Online
 */
@Exclude()
export class Character {
  @Expose()
  @BigIntTransformer.stringTransform
  readonly eveId!: string;

  @Expose()
  readonly name!: string;

  @Expose()
  readonly allianceId?: number;

  @Expose()
  readonly allianceTicker?: string;

  @Expose()
  readonly corporationId!: number;

  @Expose()
  readonly corporationTicker!: string;

  @Expose()
  readonly characterGroupId?: string;

  @Expose()
  readonly mainCharacterId?: string;

  @Expose()
  @Transform(({ value }: { value: Date | string | null }) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
  })
  readonly createdAt!: Date;

  @Expose()
  @Transform(({ value }: { value: Date | string | null }) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
  })
  readonly updatedAt!: Date;

  @Expose()
  @Transform(({ value }: { value: Date | string | null }) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
  })
  readonly lastBackfillAt?: Date;

  @Expose()
  @Transform(({ value }: { value: Date | string | null }) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
  })
  readonly lastKillmailAt?: Date;

  @Transform(({ value }: { value: Date | string | null }) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    return new Date(value);
  })
  get lastUpdatedDate(): Date {
    return this.updatedAt;
  }

  get isMain(): boolean {
    return this.mainCharacterId === this.eveId;
  }

  constructor(data: Partial<Character>) {
    Object.assign(this, data);
  }

  /**
   * Converts the character to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      eveId: this.eveId,
      name: this.name,
      allianceId: this.allianceId,
      allianceTicker: this.allianceTicker,
      corporationId: this.corporationId,
      corporationTicker: this.corporationTicker,
      characterGroupId: this.characterGroupId,
      mainCharacterId: this.mainCharacterId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastBackfillAt: this.lastBackfillAt,
      lastKillmailAt: this.lastKillmailAt,
    };
  }
}
