import { ChartData, ChartDisplayType, ChartMetric } from '../../../types/chart';

export interface IKillsChartService {
  generateKillsChart(
    characterIds: string[],
    startDate: Date,
    groupBy: string,
    displayMetric: ChartMetric,
    limit: number
  ): Promise<ChartData>;

  generateGroupedKillsChart(config: {
    characterGroups: string[];
    period: string;
    groupBy: string;
    displayType: ChartDisplayType;
    displayMetric: ChartMetric;
    limit: number;
  }): Promise<ChartData>;
}
