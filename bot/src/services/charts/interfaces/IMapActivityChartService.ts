import { ChartData, ChartDisplayType, ChartMetric } from '../../../types/chart';

export interface IMapActivityChartService {
  generateMapActivityChart(
    characterIds: string[],
    startDate: Date,
    groupBy: string,
    displayMetric: ChartMetric,
    limit: number
  ): Promise<ChartData>;

  generateGroupedMapActivityChart(config: {
    characterGroups: string[];
    period: string;
    groupBy: string;
    displayType: ChartDisplayType;
    displayMetric: ChartMetric;
    limit: number;
  }): Promise<ChartData>;
}
