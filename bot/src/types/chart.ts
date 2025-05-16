import {
  ChartType,
  ChartDataset as ChartJSDataset,
  ChartOptions as ChartJSOptions,
} from "chart.js";

export type ChartPeriod = "24h" | "7d" | "30d" | "90d";
export type ChartSourceType = "kills" | "map_activity";
export type ChartDisplayType =
  | "bar"
  | "line"
  | "pie"
  | "boxplot"
  | "violin"
  | "heatmap"
  | "calendar"
  | "doughnut"
  | "radar"
  | "polarArea"
  | "bubble"
  | "scatter"
  | "gauge";
export type ChartMetric = "value" | "kills" | "points" | "attackers";

export interface ChartConfig {
  type: ChartSourceType;
  characterIds: bigint[];
  period: ChartPeriod;
  groupBy?: "hour" | "day" | "week";
  displayType?: ChartDisplayType;
  displayMetric?: ChartMetric;
  limit?: number;
  data: ChartData;
  options?: ChartJSOptions;
}

export type ChartConfigInput = Omit<ChartConfig, "data">;

// Define complex data point type for charts like heatmaps
export interface ComplexDataPoint {
  x: number | string;
  y: number | string;
  v: number;
  min?: number;
  q1?: number;
  median?: number;
  q3?: number;
  max?: number;
  outliers?: number[];
  date?: string;
}

export interface ChartDataset {
  label: string;
  data: (number | ComplexDataPoint)[];
  backgroundColor?: string | string[] | ((context: any) => string);
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
  type?: ChartType;
  displayType?: ChartDisplayType;
  yAxisID?: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
  displayType?: ChartDisplayType;
  title?: string;
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
  width?: number;
  height?: number;
  format?: "png" | "jpg" | "jpeg" | "webp";
  quality?: number;
  background?: string;
  devicePixelRatio?: number;
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  indexAxis?: "x" | "y";
  plugins?: {
    legend?: {
      display?: boolean;
      position?: "top" | "bottom" | "left" | "right";
      labels?: {
        color?: string;
        font?: {
          size?: number;
          weight?: string;
        };
        usePointStyle?: boolean;
      };
    };
    title?: {
      display?: boolean;
      text?: string;
      color?: string;
      font?: {
        size?: number;
        weight?: string;
      };
    };
    tooltip?: {
      mode?: "index" | "dataset" | "point" | "nearest" | "x" | "y";
      intersect?: boolean;
      backgroundColor?: string;
      titleColor?: string;
      bodyColor?: string;
      borderColor?: string;
      borderWidth?: number;
      padding?: number;
      displayColors?: boolean;
      callbacks?: {
        label?: (context: any) => string;
      };
    };
  };
  scales?: {
    x?: {
      grid?: {
        color?: string;
        drawOnChartArea?: boolean;
      };
      ticks?: {
        color?: string;
        font?: {
          size?: number;
        };
        callback?: (value: any) => string;
      };
      beginAtZero?: boolean;
      stacked?: boolean;
      type?: string;
      display?: boolean;
      position?: "top" | "bottom" | "left" | "right";
      time?: {
        unit?: string;
        displayFormats?: Record<string, string>;
      };
      title?: {
        display?: boolean;
        text?: string;
        color?: string;
        font?: {
          size?: number;
          weight?: string;
        };
      };
      suggestedMin?: number;
      suggestedMax?: number;
    };
    y?: {
      grid?: {
        color?: string;
        drawOnChartArea?: boolean;
      };
      ticks?: {
        color?: string;
        font?: {
          size?: number;
        };
        callback?: (value: any) => string;
      };
      beginAtZero?: boolean;
      stacked?: boolean;
      type?: string;
      display?: boolean;
      position?: "top" | "bottom" | "left" | "right";
      time?: {
        unit?: string;
        displayFormats?: Record<string, string>;
      };
      title?: {
        display?: boolean;
        text?: string;
        color?: string;
        font?: {
          size?: number;
          weight?: string;
        };
      };
      suggestedMin?: number;
      suggestedMax?: number;
    };
    y2?: {
      grid?: {
        color?: string;
        drawOnChartArea?: boolean;
      };
      ticks?: {
        color?: string;
        font?: {
          size?: number;
        };
        callback?: (value: any) => string;
      };
      beginAtZero?: boolean;
      stacked?: boolean;
      type?: string;
      display?: boolean;
      position?: "top" | "bottom" | "left" | "right";
      time?: {
        unit?: string;
        displayFormats?: Record<string, string>;
      };
      title?: {
        display?: boolean;
        text?: string;
        color?: string;
        font?: {
          size?: number;
          weight?: string;
        };
      };
    };
  };
}

/**
 * Simple time range with start and end dates
 */
export interface SimpleTimeRange {
  start: Date;
  end: Date;
}
