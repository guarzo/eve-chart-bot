import { Character } from "./Character";

/**
 * CharacterGroup domain entity
 * Represents a group of related EVE Online characters
 */
export class CharacterGroup {
  /** Unique identifier */
  readonly id: string;

  /** Human-readable slug for the group */
  slug: string;

  /** Optional reference to the main character's EVE ID */
  mainCharacterId: string | null;

  /** Creation timestamp */
  readonly createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Characters in this group (populated on demand) */
  private _characters: Character[] | null = null;

  /**
   * Create a new CharacterGroup
   *
   * @param props Character group properties
   */
  constructor(props: {
    id: string;
    slug: string;
    mainCharacterId?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
    characters?: Character[];
  }) {
    this.id = props.id;
    this.slug = props.slug;
    this.mainCharacterId = props.mainCharacterId || null;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();

    if (props.characters) {
      this._characters = props.characters;
    }

    this.validate();
  }

  /**
   * Validate the character group
   * @throws Error if group data is invalid
   */
  private validate(): void {
    if (!this.id) {
      throw new Error("Character group must have an ID");
    }

    if (!this.slug || this.slug.trim() === "") {
      throw new Error("Character group must have a slug");
    }

    // Validate slug format (alphanumeric and hyphens only)
    if (!/^[a-z0-9-]+$/.test(this.slug)) {
      throw new Error(
        "Slug must contain only lowercase letters, numbers, and hyphens"
      );
    }
  }

  /**
   * Get characters in this group
   */
  get characters(): Character[] {
    if (!this._characters) {
      throw new Error("Characters not loaded for this group");
    }
    return this._characters;
  }

  /**
   * Set characters for this group
   */
  set characters(characters: Character[]) {
    this._characters = characters;
  }

  /**
   * Check if characters are loaded for this group
   */
  get hasCharacters(): boolean {
    return this._characters !== null;
  }

  /**
   * Get the number of characters in this group
   * @throws Error if characters are not loaded
   */
  get characterCount(): number {
    if (!this._characters) {
      throw new Error("Characters not loaded for this group");
    }
    return this._characters.length;
  }

  /**
   * Set a character as the main character for this group
   *
   * @param characterId The EVE ID of the character to set as main
   * @throws Error if character is not in this group
   */
  setMainCharacter(characterId: string): void {
    if (!this._characters) {
      throw new Error("Characters not loaded for this group");
    }

    const character = this._characters.find((c) => c.eveId === characterId);
    if (!character) {
      throw new Error(`Character ${characterId} is not in this group`);
    }

    this.mainCharacterId = characterId;
    this.updatedAt = new Date();

    // Update all characters in the group
    for (const char of this._characters) {
      if (char.eveId === characterId) {
        char.setAsMain();
      } else {
        char.setAsAltOf(characterId);
      }
    }
  }

  /**
   * Add a character to this group
   *
   * @param character The character to add
   * @throws Error if character is already in another group
   */
  addCharacter(character: Character): void {
    if (!this._characters) {
      this._characters = [];
    }

    // Check if character is already in another group
    if (character.characterGroupId && character.characterGroupId !== this.id) {
      throw new Error(
        `Character ${character.eveId} is already in group ${character.characterGroupId}`
      );
    }

    // Check if character is already in this group
    const existingIndex = this._characters.findIndex(
      (c) => c.eveId === character.eveId
    );
    if (existingIndex >= 0) {
      // Replace the existing character with the new one
      this._characters[existingIndex] = character;
    } else {
      this._characters.push(character);
    }

    // Update the character's group
    character.setGroup(this.id);

    // If this is the main character, update relationships
    if (this.mainCharacterId) {
      if (character.eveId === this.mainCharacterId) {
        character.setAsMain();
      } else {
        character.setAsAltOf(this.mainCharacterId);
      }
    } else if (this._characters.length === 1 || character.isMain) {
      // If this is the only character or it's marked as main, make it the main character
      this.setMainCharacter(character.eveId);
    }

    this.updatedAt = new Date();
  }

  /**
   * Remove a character from this group
   *
   * @param characterId The EVE ID of the character to remove
   * @throws Error if character is not in this group
   */
  removeCharacter(characterId: string): void {
    if (!this._characters) {
      throw new Error("Characters not loaded for this group");
    }

    const index = this._characters.findIndex((c) => c.eveId === characterId);
    if (index < 0) {
      throw new Error(`Character ${characterId} is not in this group`);
    }

    // Get the character before removing it
    const character = this._characters[index];

    // Remove the character
    this._characters.splice(index, 1);

    // Update the character's group reference
    character.setGroup(null);
    if (this.mainCharacterId === characterId) {
      character.setAsMain(); // Character is still a main, just not in this group

      // Need to update main character for the group
      if (this._characters.length > 0) {
        this.setMainCharacter(this._characters[0].eveId);
      } else {
        this.mainCharacterId = null;
      }
    }

    this.updatedAt = new Date();
  }

  /**
   * Convert domain entity to a plain object (useful for persistence)
   */
  toObject() {
    return {
      id: this.id,
      slug: this.slug,
      mainCharacterId: this.mainCharacterId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Create a CharacterGroup domain entity from a database model
   *
   * @param model Database model object
   * @param characters Optional characters to include in the group
   * @returns CharacterGroup domain entity
   */
  static fromModel(model: any, characters?: any[]): CharacterGroup {
    const group = new CharacterGroup({
      id: model.id,
      slug: model.slug,
      mainCharacterId: model.mainCharacterId,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });

    if (characters) {
      group.characters = characters.map((c) => Character.fromModel(c));
    }

    return group;
  }
}
