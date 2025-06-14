import { ChartConfigInput, ChartData } from '../../../types/chart';

export interface IChartService {
  generateChart(config: ChartConfigInput): Promise<ChartData>;
}
