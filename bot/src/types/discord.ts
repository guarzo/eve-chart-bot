/**
 * Types related to Discord interactions
 */

/**
 * Basic character summary for simplified display
 */
export interface CharacterSummary {
  eveId: string;
  name: string;
}

/**
 * Character group summary for discord commands
 */
export interface CharacterGroupSummary {
  groupId: string;
  name: string;
  characters: CharacterSummary[];
}

/**
 * Interface for chart command options
 */
export interface ChartCommandOptions {
  type: string;
  period: string;
  group?: string;
  character?: string;
  metric?: string;
  displayType?: string;
}

/**
 * Response structure for Discord commands
 */
export interface CommandResponse {
  content?: string;
  imageUrl?: string;
  embed?: any;
  error?: string;
}
