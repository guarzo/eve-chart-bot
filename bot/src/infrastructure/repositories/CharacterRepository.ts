import { Character } from "../../domain/character/Character";
import { CharacterGroup } from "../../domain/character/CharacterGroup";
import { PrismaMapper } from "../mapper/PrismaMapper";
import { BaseRepository } from "./BaseRepository";
import { logger } from "../../lib/logger";
import { ensureRequiredBigInt } from "../../utils/conversion";

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
    return this.executeQuery(async () => {
      const character = await this.prisma.character.findUnique({
        where: { eveId: ensureRequiredBigInt(eveId) },
      });
      return character ? PrismaMapper.map(character, Character) : null;
    });
  }

  /**
   * Get all characters
   */
  async getAllCharacters(): Promise<Character[]> {
    return this.findMany(Character, {
      modelName: "character",
    });
  }

  /**
   * Get characters by group ID
   */
  async getCharactersByGroup(groupId: string): Promise<Character[]> {
    return this.findMany(Character, {
      modelName: "character",
      where: { characterGroupId: groupId },
    });
  }

  /**
   * Create or update a character
   */
  async saveCharacter(character: Character): Promise<Character> {
    return this.executeQuery(async () => {
      const eveId = ensureRequiredBigInt(character.eveId);

      const createData = {
        eveId,
        name: character.name,
        corporationId: character.corporationId ?? 0,
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

      return this.upsert({ eveId }, createData, createData, Character);
    });
  }

  /**
   * Delete a character
   */
  async deleteCharacter(eveId: string | bigint): Promise<void> {
    return this.delete({ eveId: ensureRequiredBigInt(eveId) });
  }

  /**
   * Get a character group by ID
   */
  async getCharacterGroup(id: string): Promise<CharacterGroup | null> {
    return this.executeQuery(async () => {
      const group = await this.prisma.characterGroup.findUnique({
        where: { id },
        include: { characters: true },
      });

      if (!group) {
        return null;
      }

      // Use PrismaMapper for the entire group including nested characters
      return PrismaMapper.map(group, CharacterGroup);
    });
  }

  /**
   * Get all character groups
   */
  async getAllCharacterGroups(): Promise<CharacterGroup[]> {
    return this.executeQuery(async () => {
      const groups = await this.prisma.characterGroup.findMany({
        include: { characters: true },
      });

      logger.info(`Found ${groups.length} raw groups from database`);

      // Use PrismaMapper for consistent mapping
      return PrismaMapper.mapArray(groups, CharacterGroup);
    });
  }

  /**
   * Create or update a character group
   */
  async saveCharacterGroup(group: CharacterGroup): Promise<CharacterGroup> {
    const data = group.toJSON();
    const saved = await this.prisma.characterGroup.upsert({
      where: { id: group.id },
      update: {
        map_name: data.map_name,
        mainCharacterId: data.mainCharacterId,
      },
      create: {
        id: data.id,
        map_name: data.map_name,
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
      data: { mainCharacterId: ensureRequiredBigInt(eveId) },
      include: { characters: true },
    });

    // Map characters individually first
    const mappedCharacters =
      updated.characters?.map((char: any) =>
        PrismaMapper.map(char, Character)
      ) || [];

    // Create the group object with properly mapped characters
    const groupData = {
      ...updated,
      characters: mappedCharacters,
    };

    return PrismaMapper.map(groupData, CharacterGroup);
  }

  /**
   * Remove a character from their group
   */
  async removeFromGroup(eveId: string | bigint): Promise<Character> {
    const updated = await this.prisma.character.update({
      where: { eveId: ensureRequiredBigInt(eveId) },
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
            in: eveIds.map((id) => ensureRequiredBigInt(id)),
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
        allianceId: allianceId ?? undefined,
        corporationId: corporationId ?? 0,
      },
      create: {
        characterId,
        timestamp,
        signatures,
        connections,
        passages,
        allianceId: allianceId ?? undefined,
        corporationId: corporationId ?? 0,
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
   * Get characters by map name
   */
  async getCharactersByMapName(mapName: string): Promise<Character[]> {
    const characters = await this.prisma.character.findMany({
      where: {
        characterGroup: {
          map_name: mapName,
        },
      },
    });
    return characters.map((char: any) => PrismaMapper.map(char, Character));
  }

  public async count(): Promise<number> {
    return this.prisma.character.count();
  }

  /**
   * Get a character by their EVE ID
   */
  async getCharacterByEveId(eveId: string | bigint): Promise<Character | null> {
    return this.executeQuery(async () => {
      const character = await this.prisma.character.findUnique({
        where: {
          eveId: ensureRequiredBigInt(eveId),
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
      where: { eveId: ensureRequiredBigInt(eveId) },
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
      data: {
        mainCharacterId: ensureRequiredBigInt(mainCharacterId),
      },
      include: { characters: true },
    });
    return PrismaMapper.map(updated, CharacterGroup);
  }

  /**
   * Create a new character group
   */
  async createCharacterGroup(
    mapName: string,
    mainCharacterId?: string | bigint
  ): Promise<CharacterGroup> {
    const created = await this.prisma.characterGroup.create({
      data: {
        map_name: mapName,
        mainCharacterId: mainCharacterId
          ? ensureRequiredBigInt(mainCharacterId)
          : null,
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
