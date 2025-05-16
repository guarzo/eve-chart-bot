export type ChartType = "kills" | "map_activity";
export type ChartPeriod = "24h" | "7d" | "30d" | "90d";
export type ChartDisplayType =
  | "line"
  | "bar"
  | "horizontalBar"
  | "matrix"
  | "pie"
  | "heatmap"
  | "calendar";
export type ChartMetric = "value" | "kills" | "points" | "attackers";

export interface ChartConfig {
  type: ChartType;
  characterIds: bigint[];
  period: ChartPeriod;
  groupBy?: "hour" | "day" | "week";
  displayType?: ChartDisplayType;
  displayMetric?: ChartMetric;
  limit?: number;
}

// Define complex data point type for charts like heatmaps
export interface ComplexDataPoint {
  x: number | string;
  y: number | string;
  v: number;
  [key: string]: any;
}

export interface ChartDataset {
  label: string;
  data: (number | ComplexDataPoint)[];
  backgroundColor?: string | string[] | ((ctx: any) => string);
  borderColor?: string | string[];
  borderWidth?: number;
  type?: string;
  stack?: string;
  yAxisID?: string;
  [key: string]: any;
}

export interface ChartData {
  labels?: string[];
  datasets: ChartDataset[];
  title?: string;
  displayType?: ChartDisplayType;
  summary?: string;
  options?: ChartOptions;
}

export interface ScaleOptions {
  stacked?: boolean;
  beginAtZero?: boolean;
  type?: string;
  position?: "left" | "right";
  display?: boolean;
  suggestedMin?: number;
  suggestedMax?: number;
  labels?: string[];
  title?: {
    display: boolean;
    text: string;
    font?: {
      size?: number;
      weight?: "bold" | "normal" | "lighter" | "bolder";
    };
  };
  grid?: {
    color: string;
    lineWidth?: number;
    drawOnChartArea?: boolean;
  };
  ticks?: {
    font?: {
      size?: number;
      weight?: "bold" | "normal" | "lighter" | "bolder";
    };
    color?: string;
    padding?: number;
    maxRotation?: number;
    minRotation?: number;
    autoSkip?: boolean;
    maxTicksLimit?: number;
    callback?: (value: any) => string;
  };
  time?: {
    unit: string;
    displayFormats: Record<string, string>;
  };
}

export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  indexAxis?: "x" | "y";
  animation?: boolean;
  devicePixelRatio?: number;
  layout?: {
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
  plugins?: {
    legend?: {
      display?: boolean;
      position?: "top" | "bottom" | "left" | "right";
      labels?: {
        padding?: number;
        boxWidth?: number;
        boxHeight?: number;
        font?: {
          size?: number;
          weight?: "bold" | "normal" | "lighter" | "bolder";
        };
        color?: string;
        usePointStyle?: boolean;
        filter?: (legendItem: any, data: any) => boolean;
      };
    };
    title?: {
      display?: boolean;
      text?: string;
      font?: {
        size?: number;
        weight?: "bold" | "normal" | "lighter" | "bolder";
      };
      color?: string;
      padding?: { top?: number; bottom?: number };
    };
    tooltip?: {
      backgroundColor?: string;
      titleFont?: {
        size?: number;
        weight?: "bold" | "normal" | "lighter" | "bolder";
      };
      bodyFont?: {
        size?: number;
      };
      padding?: number;
      mode?: "index" | "dataset" | "point" | "nearest" | "x" | "y";
      intersect?: boolean;
      callbacks?: {
        label?: (context: any) => string | string[];
        title?: (context: any) => string | string[];
      };
    };
  };
  scales?: {
    x?: ScaleOptions;
    y?: ScaleOptions;
    [key: string]: ScaleOptions | undefined;
  };
}

/**
 * Simple time range with start and end dates
 */
export interface SimpleTimeRange {
  start: Date;
  end: Date;
}
