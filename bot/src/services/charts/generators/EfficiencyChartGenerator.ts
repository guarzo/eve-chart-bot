import { BaseChartGenerator } from "../BaseChartGenerator";
import { ChartData, ChartDisplayType } from "../../../types/chart";
import { KillRepository } from "../../../data/repositories/KillRepository";
import { LossRepository } from "../../../data/repositories/LossRepository";
import { KillsChartGenerator } from "./KillsChartGenerator";
import { LossChartGenerator } from "./LossChartGenerator";
import { EfficiencyChartConfig } from "../config/EfficiencyChartConfig";
import { EfficiencyGaugeConfig } from "../config/EfficiencyGaugeConfig";
import { logger } from "../../../lib/logger";
import { chartPalette } from "../config/theme";
import { format } from "date-fns";

interface Kill {
  characterId: bigint;
  timestamp: Date;
}

interface Loss {
  characterId: bigint;
  timestamp: Date;
  totalValue: bigint;
}

/**
 * Generator for efficiency charts
 */
export class EfficiencyChartGenerator extends BaseChartGenerator {
  private killRepository: KillRepository;
  private lossRepository: LossRepository;
  private killsGenerator = new KillsChartGenerator();
  private lossGenerator = new LossChartGenerator();

  constructor() {
    super();
    this.killRepository = new KillRepository();
    this.lossRepository = new LossRepository();
  }

  async generateChart(options: {
    startDate: Date;
    endDate: Date;
    characterGroups: Array<{
      groupId: string;
      name: string;
      characters: Array<{ eveId: string; name: string }>;
      mainCharacterId?: string;
    }>;
    displayType: string;
  }): Promise<ChartData> {
    const { startDate, endDate, characterGroups, displayType } = options;
    logger.info("Generating efficiency chart");

    // Get all character IDs from all groups
    const characterIds = characterGroups.flatMap((group) =>
      group.characters.map((c) => BigInt(c.eveId))
    );

    // Get kills and losses for all characters
    const [kills, losses] = await Promise.all([
      this.killRepository.getKillsForCharacters(
        characterIds.map((id) => id.toString()),
        startDate,
        endDate
      ),
      this.lossRepository.getLossesByTimeRange(
        characterIds.map((id) => id.toString()),
        { start: startDate, end: endDate }
      ),
    ]);

    // Group data by character group
    const groupData = characterGroups.map((group) => {
      const groupCharacterIds = group.characters.map((c) => BigInt(c.eveId));
      const groupKills = kills.filter((kill) =>
        groupCharacterIds.includes(BigInt(kill.character_id))
      );
      const groupLosses = losses.filter((loss) =>
        groupCharacterIds.includes(BigInt(loss.character_id))
      );

      const totalKills = groupKills.length;
      const totalLosses = groupLosses.length;
      const efficiency =
        totalKills + totalLosses > 0
          ? (totalKills / (totalKills + totalLosses)) * 100
          : 0;

      return {
        group,
        kills: groupKills,
        losses: groupLosses,
        totalKills,
        totalLosses,
        efficiency,
      };
    });

    // Sort groups by efficiency
    groupData.sort((a, b) => b.efficiency - a.efficiency);

    // Create chart data
    return {
      labels: groupData.map((data) => this.getGroupDisplayName(data.group)),
      datasets: [
        {
          label: "Efficiency (%)",
          data: groupData.map((data) => data.efficiency),
          backgroundColor: this.getDatasetColors("kills").primary,
        },
        {
          label: "Total Kills",
          data: groupData.map((data) => data.totalKills),
          backgroundColor: this.getDatasetColors("kills").secondary,
        },
        {
          label: "Total Losses",
          data: groupData.map((data) => data.totalLosses),
          backgroundColor: this.getDatasetColors("loss").primary,
        },
      ],
      displayType: "horizontalBar" as ChartDisplayType,
    };
  }
}
