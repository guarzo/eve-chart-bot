// Enhanced group data with main character information
const enhancedGroups = await Promise.all(
  characterGroups.map(async (group) => {
    // Try to find main character in the group
    let mainCharacter = null;

    // First, check if the group has a mainCharacterId set
    if (group.mainCharacterId) {
      mainCharacter = group.characters.find(
        (c) => c.eveId === group.mainCharacterId
      );
    }

    // If no main was found by ID, try to find characters that are designated as mains
    if (!mainCharacter) {
      for (const character of group.characters) {
        // Check if this character has alts (other characters pointing to it as main)
        const hasAlts = await this.prisma.character.count({
          where: {
            mainCharacterId: character.eveId,
          },
        });

        if (hasAlts > 0) {
          // This is a main character
          mainCharacter = character;
          break;
        }
      }
    }

    // If still no main was found, just use the first character
    if (!mainCharacter && group.characters.length > 0) {
      mainCharacter = group.characters[0];
    }

    // Use just the character name as the display name
    const displayName = mainCharacter
      ? mainCharacter.name
      : group.characters.length > 0
      ? group.characters[0].name
      : group.name;

    return {
      ...group,
      mainCharacter,
      displayName,
    };
  })
);
