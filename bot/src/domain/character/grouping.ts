import { logger } from "../../lib/logger";
import { CharacterRepository } from "../../infrastructure/repositories/CharacterRepository";

/**
 * Create a character group only if we have characters to associate with it
 * @param characterRepository Character repository instance
 * @param slug The group slug
 * @param characterIds Array of character IDs to associate with the group
 * @param mainCharacterId Optional main character ID for the group
 * @returns The created group ID or null if no group was created
 */
export async function createCharacterGroupSafely(
  characterRepository: CharacterRepository,
  slug: string,
  characterIds: string[],
  mainCharacterId?: string
): Promise<string | null> {
  try {
    // Validate inputs
    if (!slug) {
      logger.error("Cannot create group: missing slug");
      return null;
    }

    if (!characterIds || characterIds.length === 0) {
      logger.warn(`Cannot create group '${slug}': no characters provided`);
      return null;
    }

    // First, check if any of these characters already belong to a group
    const existingCharacters = await characterRepository.getCharactersByEveIds(
      characterIds
    );
    const charactersWithGroups = existingCharacters.filter(
      (char) => char.characterGroupId
    );

    // If some characters already belong to a group, use that group instead of creating a new one
    if (
      charactersWithGroups.length > 0 &&
      charactersWithGroups[0].characterGroup
    ) {
      // Use the first character's group as the target group for all characters
      const existingGroup = charactersWithGroups[0].characterGroup;
      logger.info(
        `Found existing group ${existingGroup.id} (${existingGroup.slug}) for ${charactersWithGroups.length} characters`
      );

      // Update all provided characters to use this group
      await Promise.all(
        characterIds.map((charId) =>
          characterRepository.updateCharacterGroup(charId, existingGroup.id)
        )
      );

      // Update main character if provided
      if (mainCharacterId) {
        await characterRepository.updateGroupMainCharacter(
          existingGroup.id,
          mainCharacterId
        );
      }

      return existingGroup.id;
    }

    // Check if characters exist in the database
    if (existingCharacters.length === 0) {
      logger.warn(`Cannot create group '${slug}': no valid characters found`);
      return null;
    }

    logger.info(
      `Creating character group '${slug}' with ${existingCharacters.length} characters`
    );

    // Create the group and associate characters
    const group = await characterRepository.createCharacterGroup(
      slug,
      mainCharacterId
    );

    // Associate characters with the group
    await Promise.all(
      existingCharacters.map((char) =>
        characterRepository.updateCharacterGroup(char.eveId, group.id)
      )
    );

    logger.info(
      `Successfully created character group ${group.id} with ${existingCharacters.length} characters`
    );
    return group.id;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      `Failed to create character group '${slug}'`
    );
    return null;
  }
}

/**
 * A safer version of the upsert operation that ensures groups always have characters
 * @param characterRepository Character repository instance
 * @param slug The group slug
 * @param characterIds Array of character IDs to associate with the group
 * @param mainCharacterId Optional main character ID for the group
 * @returns The created/updated group ID or null if no group was created/updated
 */
export async function upsertCharacterGroupSafely(
  characterRepository: CharacterRepository,
  slug: string,
  characterIds: string[],
  mainCharacterId?: string
): Promise<string | null> {
  try {
    // First, check if any of these characters already belong to a group
    if (characterIds && characterIds.length > 0) {
      const existingCharacters =
        await characterRepository.getCharactersByEveIds(characterIds);
      const charactersWithGroups = existingCharacters.filter(
        (char) => char.characterGroupId
      );

      // If some characters already belong to a group, use that group instead of creating a new one
      if (
        charactersWithGroups.length > 0 &&
        charactersWithGroups[0].characterGroup
      ) {
        // Use the first character's group as the target group for all characters
        const existingGroup = charactersWithGroups[0].characterGroup;
        logger.info(
          `Found existing group ${existingGroup.id} (${existingGroup.slug}) for ${charactersWithGroups.length} characters`
        );

        // Update all provided characters to use this group
        await Promise.all(
          characterIds.map((charId) =>
            characterRepository
              .updateCharacterGroup(charId, existingGroup.id)
              .catch((e) => {
                logger.warn(
                  `Could not update character ${charId}: ${e.message}`
                );
                return null;
              })
          )
        );

        // Update main character if provided
        if (mainCharacterId) {
          await characterRepository.updateGroupMainCharacter(
            existingGroup.id,
            mainCharacterId
          );
        }

        return existingGroup.id;
      }
    }

    // If no existing group was found, create a new one
    return createCharacterGroupSafely(
      characterRepository,
      slug,
      characterIds,
      mainCharacterId
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      `Failed to upsert character group '${slug}'`
    );
    return null;
  }
}

/**
 * Remove empty character groups to keep the database clean
 * @param characterRepository Character repository instance
 * @returns The number of groups that were removed
 */
export async function cleanupEmptyCharacterGroups(
  characterRepository: CharacterRepository
): Promise<number> {
  try {
    const emptyGroups = await characterRepository.getEmptyGroups();

    if (emptyGroups.length === 0) {
      logger.info("No empty character groups found");
      return 0;
    }

    // Delete each empty group
    await Promise.all(
      emptyGroups.map((group) => characterRepository.deleteGroup(group.id))
    );

    logger.info(`Removed ${emptyGroups.length} empty character groups`);
    return emptyGroups.length;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Failed to cleanup empty character groups"
    );
    return 0;
  }
}
