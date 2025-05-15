import { prismaMock } from "../../setup";
import {
  createCharacterGroupSafely,
  upsertCharacterGroupSafely,
  cleanupEmptyCharacterGroups,
} from "../../../src/domain/character/grouping";

describe("Character Grouping", () => {
  describe("createCharacterGroupSafely", () => {
    it("should return null when no slug is provided", async () => {
      const result = await createCharacterGroupSafely(prismaMock, "", [
        "123",
        "456",
      ]);
      expect(result).toBeNull();
    });

    it("should return null when no characters are provided", async () => {
      const result = await createCharacterGroupSafely(
        prismaMock,
        "test-group",
        []
      );
      expect(result).toBeNull();
    });

    it("should return null when characters don't exist in database", async () => {
      prismaMock.character.findMany.mockResolvedValue([]);

      const result = await createCharacterGroupSafely(
        prismaMock,
        "test-group",
        ["123", "456"]
      );

      expect(result).toBeNull();
      expect(prismaMock.character.findMany).toHaveBeenCalledWith({
        where: {
          eveId: {
            in: ["123", "456"],
          },
        },
      });
    });

    it("should create a new group when characters exist", async () => {
      // Mock existing characters without groups
      prismaMock.character.findMany.mockImplementation((args) => {
        if (args.where?.characterGroupId) {
          return Promise.resolve([]);
        } else {
          return Promise.resolve([
            { eveId: "123", name: "Char1" },
            { eveId: "456", name: "Char2" },
          ]);
        }
      });

      // Mock transaction
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const mockGroup = {
          id: "new-group-id",
          slug: "test-group",
          mainCharacterId: null,
        };
        return callback(prismaMock).then(() => mockGroup);
      });

      // Mock group creation
      prismaMock.characterGroup.create.mockResolvedValue({
        id: "new-group-id",
        slug: "test-group",
        mainCharacterId: null,
      });

      const result = await createCharacterGroupSafely(
        prismaMock,
        "test-group",
        ["123", "456"]
      );

      expect(result).toBe("new-group-id");
      expect(prismaMock.characterGroup.create).toHaveBeenCalledWith({
        data: {
          slug: "test-group",
          mainCharacterId: null,
        },
      });
    });

    it("should use existing group when characters already belong to a group", async () => {
      // Mock characters with existing group
      prismaMock.character.findMany.mockResolvedValue([
        {
          eveId: "123",
          name: "Char1",
          characterGroupId: "existing-group-id",
          characterGroup: {
            id: "existing-group-id",
            slug: "existing-group",
            mainCharacterId: null,
          },
        },
      ]);

      const result = await createCharacterGroupSafely(
        prismaMock,
        "test-group",
        ["123", "456", "789"]
      );

      expect(result).toBe("existing-group-id");
      expect(prismaMock.character.updateMany).toHaveBeenCalledTimes(3);
    });
  });

  describe("cleanupEmptyCharacterGroups", () => {
    it("should return 0 when no empty groups exist", async () => {
      prismaMock.characterGroup.findMany.mockResolvedValue([]);

      const result = await cleanupEmptyCharacterGroups(prismaMock);

      expect(result).toBe(0);
    });

    it("should delete empty groups", async () => {
      prismaMock.characterGroup.findMany.mockResolvedValue([
        { id: "empty-group-1", slug: "empty1", _count: { characters: 0 } },
        { id: "empty-group-2", slug: "empty2", _count: { characters: 0 } },
      ]);

      const result = await cleanupEmptyCharacterGroups(prismaMock);

      expect(result).toBe(2);
      expect(prismaMock.characterGroup.delete).toHaveBeenCalledTimes(2);
    });
  });
});
