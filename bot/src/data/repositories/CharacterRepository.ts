import { BaseRepository } from "./BaseRepository";
import { Character, Prisma } from "@prisma/client";

/**
 * Repository for character-related data access
 */
export class CharacterRepository extends BaseRepository {
  constructor() {
    super("Character");
  }

  /**
   * Get all tracked characters
   */
  async getTrackedCharacters(): Promise<Character[]> {
    return this.executeQuery(
      () =>
        this.prisma.character.findMany({
          orderBy: {
            name: "asc",
          },
        }),
      "tracked-characters"
    );
  }

  /**
   * Get character by EVE ID
   */
  async getCharacterById(eveId: string): Promise<Character | null> {
    return this.executeQuery(
      () =>
        this.prisma.character.findUnique({
          where: {
            eveId,
          },
        }),
      `character-${eveId}`
    );
  }

  /**
   * Get all characters belonging to a main character (alts)
   */
  async getCharacterAlts(mainCharacterId: string): Promise<Character[]> {
    return this.executeQuery(
      () =>
        this.prisma.character.findMany({
          where: {
            mainCharacterId,
          },
          orderBy: {
            name: "asc",
          },
        }),
      `alts-${mainCharacterId}`
    );
  }

  /**
   * Get all characters including main and alts for a list of main character IDs
   */
  async getExpandedCharacterList(
    mainCharacterIds: string[]
  ): Promise<Character[]> {
    return this.executeQuery(async () => {
      // Get all main characters
      const mainCharacters = await this.prisma.character.findMany({
        where: {
          eveId: {
            in: mainCharacterIds,
          },
        },
      });

      // Get all alt characters
      const altCharacters = await this.prisma.character.findMany({
        where: {
          mainCharacterId: {
            in: mainCharacterIds,
          },
        },
      });

      // Combine and return unique characters
      return [...mainCharacters, ...altCharacters];
    }, `expanded-characters-${mainCharacterIds.join("-")}`);
  }

  /**
   * Get all character groups with their characters
   */
  async getCharacterGroups(): Promise<
    Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>
  > {
    return this.executeQuery(async () => {
      // Get all character groups
      const groups = await this.prisma.characterGroup.findMany({
        select: {
          id: true,
          slug: true,
          mainCharacterId: true,
          characters: {
            select: {
              eveId: true,
              name: true,
            },
          },
        },
        orderBy: {
          slug: "asc" as Prisma.SortOrder,
        },
      });

      // Format the response with explicit type annotation
      return groups.map((group) => ({
        groupId: group.id,
        name: group.slug,
        mainCharacterId: group.mainCharacterId || undefined,
        characters: group.characters.map(
          (char: { eveId: string; name: string }) => ({
            eveId: char.eveId,
            name: char.name,
          })
        ),
      }));
    }, "character-groups");
  }
}
