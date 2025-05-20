import { Character } from "../../domain/character/Character";
import { CharacterGroup } from "../../domain/character/CharacterGroup";
import { PrismaMapper } from "../mapper/PrismaMapper";
import { BaseRepository } from "./BaseRepository";

/**
 * Repository for character-related data access
 */
export class CharacterRepository extends BaseRepository {
  constructor() {
    super("Character");
  }

  /**
   * Get a character by their EVE ID
   */
  async getCharacter(eveId: string | bigint): Promise<Character | null> {
    const character = await this.prisma.character.findUnique({
      where: { eveId: BigInt(eveId) },
    });
    return character ? PrismaMapper.map(character, Character) : null;
  }

  /**
   * Get all characters
   */
  async getAllCharacters(): Promise<Character[]> {
    const characters = await this.prisma.character.findMany();
    return characters.map((char: any) => PrismaMapper.map(char, Character));
  }

  /**
   * Get characters by group ID
   */
  async getCharactersByGroup(groupId: string): Promise<Character[]> {
    const characters = await this.prisma.character.findMany({
      where: { characterGroupId: groupId },
    });
    return characters.map((char: any) => PrismaMapper.map(char, Character));
  }

  /**
   * Create or update a character
   */
  async saveCharacter(character: Character): Promise<Character> {
    return this.executeQuery(async () => {
      const createData = {
        eveId: BigInt(character.eveId),
        name: character.name,
        corporationId: character.corporationId,
        corporationTicker: character.corporationTicker,
        ...(character.allianceId && { allianceId: character.allianceId }),
        ...(character.allianceTicker && {
          allianceTicker: character.allianceTicker,
        }),
        ...(character.characterGroupId && {
          characterGroupId: character.characterGroupId,
        }),
        ...(character.lastBackfillAt && {
          lastBackfillAt: character.lastBackfillAt,
        }),
      };

      const saved = await this.prisma.character.upsert({
        where: {
          eveId: BigInt(character.eveId),
        },
        create: createData,
        update: {
          name: character.name,
          corporationId: character.corporationId,
          corporationTicker: character.corporationTicker,
          ...(character.allianceId && { allianceId: character.allianceId }),
          ...(character.allianceTicker && {
            allianceTicker: character.allianceTicker,
          }),
          ...(character.characterGroupId && {
            characterGroupId: character.characterGroupId,
          }),
          ...(character.lastBackfillAt && {
            lastBackfillAt: character.lastBackfillAt,
          }),
        },
      });
      return PrismaMapper.map(saved, Character);
    });
  }

  /**
   * Delete a character
   */
  async deleteCharacter(eveId: string | bigint): Promise<void> {
    await this.prisma.character.delete({
      where: { eveId: BigInt(eveId) },
    });
  }

  /**
   * Get a character group by ID
   */
  async getCharacterGroup(id: string): Promise<CharacterGroup | null> {
    const group = await this.prisma.characterGroup.findUnique({
      where: { id },
      include: { characters: true },
    });
    return group ? PrismaMapper.map(group, CharacterGroup) : null;
  }

  /**
   * Get all character groups
   */
  async getAllCharacterGroups(): Promise<CharacterGroup[]> {
    const groups = await this.prisma.characterGroup.findMany({
      include: { characters: true },
    });
    return groups.map((group: any) => PrismaMapper.map(group, CharacterGroup));
  }

  /**
   * Create or update a character group
   */
  async saveCharacterGroup(group: CharacterGroup): Promise<CharacterGroup> {
    const data = group.toJSON();
    const saved = await this.prisma.characterGroup.upsert({
      where: { id: group.id },
      update: {
        slug: data.slug,
        mainCharacterId: data.mainCharacterId,
      },
      create: {
        id: data.id,
        slug: data.slug,
        mainCharacterId: data.mainCharacterId,
      },
    });
    return PrismaMapper.map(saved, CharacterGroup);
  }

  /**
   * Delete a character group
   */
  async deleteCharacterGroup(id: string): Promise<void> {
    await this.prisma.characterGroup.delete({
      where: { id },
    });
  }

  /**
   * Set a character as the main character of their group
   */
  async setMainCharacter(eveId: string | bigint): Promise<CharacterGroup> {
    const character = await this.getCharacter(eveId);
    if (!character || !character.characterGroupId) {
      throw new Error("Character not found or not in a group");
    }
    const updated = await this.prisma.characterGroup.update({
      where: { id: character.characterGroupId },
      data: { mainCharacterId: BigInt(eveId) },
      include: { characters: true },
    });
    return PrismaMapper.map(updated, CharacterGroup);
  }

  /**
   * Remove a character from their group
   */
  async removeFromGroup(eveId: string | bigint): Promise<Character> {
    const updated = await this.prisma.character.update({
      where: { eveId: BigInt(eveId) },
      data: { characterGroupId: null },
    });
    return PrismaMapper.map(updated, Character);
  }

  /**
   * Get characters by their EVE IDs
   */
  async getCharactersByEveIds(
    eveIds: (string | bigint)[]
  ): Promise<Character[]> {
    return this.executeQuery(async () => {
      const characters = await this.prisma.character.findMany({
        where: {
          eveId: {
            in: eveIds.map((id) => BigInt(id)),
          },
        },
      });
      return PrismaMapper.mapArray(characters, Character);
    });
  }

  /**
   * Get all characters that are in groups
   */
  async getCharactersInGroups(): Promise<Character[]> {
    const characters = await this.prisma.character.findMany({
      where: { characterGroupId: { not: null } },
      select: {
        eveId: true,
        name: true,
      },
    });
    return characters.map((char: any) => PrismaMapper.map(char, Character));
  }

  /**
   * Get the count of map activity records
   */
  async getMapActivityCount(): Promise<number> {
    return this.prisma.mapActivity.count();
  }

  /**
   * Delete all map activity records
   */
  async deleteAllMapActivity(): Promise<{ count: number }> {
    const deleted = await this.prisma.mapActivity.deleteMany({});
    return { count: deleted.count };
  }

  /**
   * Create or update a map activity record
   */
  async upsertMapActivity(
    characterId: bigint,
    timestamp: Date,
    signatures: number,
    connections: number,
    passages: number,
    allianceId: number | null,
    corporationId: number | null
  ): Promise<void> {
    if (corporationId === null) {
      throw new Error("corporationId is required");
    }
    await this.prisma.mapActivity.upsert({
      where: {
        characterId_timestamp: {
          characterId,
          timestamp,
        },
      },
      update: {
        signatures,
        connections,
        passages,
        allianceId,
        corporationId,
      },
      create: {
        characterId,
        timestamp,
        signatures,
        connections,
        passages,
        allianceId,
        corporationId,
      },
    });
  }

  /**
   * Create or update an ingestion checkpoint
   */
  async upsertIngestionCheckpoint(
    type: string,
    characterId: bigint
  ): Promise<{ lastSeenId: bigint; lastSeenTime: Date }> {
    const checkpoint = await this.prisma.ingestionCheckpoint.upsert({
      where: { streamName: `${type}:${characterId}` },
      update: {},
      create: {
        streamName: `${type}:${characterId}`,
        lastSeenId: BigInt(0),
        lastSeenTime: new Date(),
      },
    });
    return {
      lastSeenId: checkpoint.lastSeenId,
      lastSeenTime: checkpoint.lastSeenTime,
    };
  }

  /**
   * Update an ingestion checkpoint
   */
  async updateIngestionCheckpoint(
    type: string,
    characterId: bigint,
    lastSeenId: bigint
  ): Promise<void> {
    await this.prisma.ingestionCheckpoint.update({
      where: { streamName: `${type}:${characterId}` },
      data: {
        lastSeenId,
        lastSeenTime: new Date(),
      },
    });
  }

  /**
   * Update a character's last backfill timestamp
   */
  async updateLastBackfillAt(characterId: bigint): Promise<void> {
    await this.prisma.character.update({
      where: { eveId: characterId },
      data: { lastBackfillAt: new Date() },
    });
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(): Promise<void> {
    await this.prisma.$transaction([]);
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(): Promise<void> {
    // No-op as Prisma handles transaction commits automatically
  }

  /**
   * Get characters by map name (slug)
   */
  async getCharactersByMapName(mapName: string): Promise<Character[]> {
    const characters = await this.prisma.character.findMany({
      where: {
        characterGroup: {
          slug: mapName,
        },
      },
    });
    return characters.map((char: any) => PrismaMapper.map(char, Character));
  }

  public async count(): Promise<number> {
    return this.prisma.character.count();
  }

  async getCharacterByEveId(eveId: string | bigint): Promise<Character | null> {
    return this.executeQuery(async () => {
      const character = await this.prisma.character.findUnique({
        where: {
          eveId: BigInt(eveId),
        },
      });
      if (!character) {
        return null;
      }
      return PrismaMapper.map(character, Character);
    });
  }

  /**
   * Update a character's group
   */
  async updateCharacterGroup(
    eveId: string | bigint,
    groupId: string
  ): Promise<Character> {
    const updated = await this.prisma.character.update({
      where: { eveId: BigInt(eveId) },
      data: { characterGroupId: groupId },
    });
    return PrismaMapper.map(updated, Character);
  }

  /**
   * Update a group's main character
   */
  async updateGroupMainCharacter(
    groupId: string,
    mainCharacterId: string | bigint
  ): Promise<CharacterGroup> {
    const updated = await this.prisma.characterGroup.update({
      where: { id: groupId },
      data: { mainCharacterId: BigInt(mainCharacterId) },
      include: { characters: true },
    });
    return PrismaMapper.map(updated, CharacterGroup);
  }

  /**
   * Create a new character group
   */
  async createCharacterGroup(
    slug: string,
    mainCharacterId?: string | bigint
  ): Promise<CharacterGroup> {
    const created = await this.prisma.characterGroup.create({
      data: {
        slug,
        mainCharacterId: mainCharacterId ? BigInt(mainCharacterId) : null,
      },
      include: { characters: true },
    });
    return PrismaMapper.map(created, CharacterGroup);
  }

  /**
   * Get empty character groups (groups with no characters)
   */
  async getEmptyGroups(): Promise<CharacterGroup[]> {
    const groups = await this.prisma.characterGroup.findMany({
      where: {
        characters: {
          none: {},
        },
      },
      include: { characters: true },
    });
    return groups.map((group: any) => PrismaMapper.map(group, CharacterGroup));
  }

  /**
   * Delete a group
   */
  async deleteGroup(groupId: string): Promise<void> {
    await this.prisma.characterGroup.delete({
      where: { id: groupId },
    });
  }
}
