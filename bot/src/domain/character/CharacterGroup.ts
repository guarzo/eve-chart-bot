import { Exclude, Expose, Transform } from "class-transformer";
import { Character } from "./Character";

/**
 * CharacterGroup domain entity
 * Represents a group of characters in EVE Online
 */
@Exclude()
export class CharacterGroup {
  @Expose()
  readonly id!: string;

  @Expose()
  readonly map_name!: string;

  @Expose()
  @Transform(({ value }) => value?.toString())
  readonly mainCharacterId?: string;

  @Expose()
  readonly characters: Character[] = [];

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

  // Computed property for name - use map_name as the display name
  get name(): string {
    return this.map_name;
  }

  constructor(data: Partial<CharacterGroup>) {
    Object.assign(this, data);
  }

  /**
   * Converts the character group to a plain object
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      map_name: this.map_name,
      mainCharacterId: this.mainCharacterId,
      characters: this.characters.map((char) => char.toJSON()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Gets the main character of the group
   */
  getMainCharacter(): Character | undefined {
    return this.characters?.find((c) => c.eveId === this.mainCharacterId);
  }

  /**
   * Gets all alt characters in the group
   */
  getAltCharacters(): Character[] {
    return (
      this.characters?.filter((c) => c.eveId !== this.mainCharacterId) || []
    );
  }

  /**
   * Checks if a character is the main character of the group
   */
  isMainCharacter(characterId: string): boolean {
    return this.mainCharacterId === characterId;
  }

  /**
   * Checks if a character is an alt in the group
   */
  isAltCharacter(characterId: string): boolean {
    return (
      (this.mainCharacterId !== characterId &&
        this.characters?.some((c) => c.eveId === characterId)) ||
      false
    );
  }
}
