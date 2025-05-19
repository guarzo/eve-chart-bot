import { BaseRepository } from "./BaseRepository";
import { Character, Prisma } from "@prisma/client";
import { buildWhereFilter } from "../../utils/query-helper";

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
    return this.executeQuery(() =>
      this.prisma.character.findMany({
        orderBy: {
          name: "asc",
        },
      })
    );
  }

  /**
   * Get character by EVE ID
   */
  async getCharacterById(eveId: string): Promise<Character | null> {
    return this.executeQuery(() =>
      this.prisma.character.findUnique({
        where: { eveId },
      })
    );
  }

  /**
   * Get all characters belonging to a main character (alts)
   */
  async getCharacterAlts(mainCharacterId: string): Promise<Character[]> {
    return this.executeQuery(() => {
      const where = buildWhereFilter({ mainCharacterId });
      return this.prisma.character.findMany({
        where,
        orderBy: {
          name: "asc",
        },
      });
    });
  }

  /**
   * Get all characters including main and alts for a list of main character IDs
   */
  async getExpandedCharacterList(
    mainCharacterIds: string[]
  ): Promise<Character[]> {
    return this.executeQuery(async () => {
      // Get all main characters
      const mainWhere = buildWhereFilter({
        eveId: {
          in: mainCharacterIds,
        },
      });

      const mainCharacters = await this.prisma.character.findMany({
        where: mainWhere,
      });

      // Get all alt characters
      const altWhere = buildWhereFilter({
        mainCharacterId: {
          in: mainCharacterIds,
        },
      });

      const altCharacters = await this.prisma.character.findMany({
        where: altWhere,
      });

      // Combine and return unique characters
      return [...mainCharacters, ...altCharacters];
    });
  }

  /**
   * Get a single character group with its characters
   * @param groupId ID of the character group to retrieve
   * @returns The group and its characters, or null if not found
   */
  async getGroupWithCharacters(groupId: string): Promise<{
    groupId: string;
    name: string;
    characters: Array<{ eveId: string; name: string }>;
    mainCharacterId?: string;
  } | null> {
    return this.executeQuery(async () => {
      // Get the character group
      const group = await this.prisma.characterGroup.findUnique({
        where: { id: groupId },
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
      });

      if (!group) return null;

      // Format the response
      return {
        groupId: group.id,
        name: group.slug,
        mainCharacterId: group.mainCharacterId || undefined,
        characters: group.characters.map(
          (char: { eveId: string; name: string }) => ({
            eveId: char.eveId,
            name: char.name,
          })
        ),
      };
    });
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
    });
  }
}
