export type ChartType = "kills" | "map_activity";
export type ChartPeriod = "24h" | "7d" | "30d" | "90d";
export type ChartDisplayType = "line" | "bar" | "horizontalBar";
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
  x: string | number;
  y: string | number;
  v: number;
  date?: string;
  [key: string]: any; // Allow for additional properties
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[] | ComplexDataPoint[];
    backgroundColor?: string | string[] | ((ctx: any) => string);
    borderColor?: string | string[];
    fill?: boolean;
    borderDash?: number[];
    type?:
      | "line"
      | "bar"
      | "radar"
      | "doughnut"
      | "pie"
      | "polarArea"
      | "bubble"
      | "scatter";
    yAxisID?: string;
  }[];
  title?: string;
  displayType?: string;
  summary?: string;
  options?: ChartOptions;
}

export interface ChartOptions {
  responsive: boolean;
  maintainAspectRatio: boolean;
  aspectRatio?: number;
  indexAxis?: "x" | "y";
  plugins?: {
    title?: {
      display: boolean;
      text: string;
      font?: {
        size?: number;
        weight?: "bold" | "normal" | "lighter" | "bolder" | number;
      };
    };
    legend?: {
      display: boolean;
      position?: "top" | "bottom" | "left" | "right";
      align?: "start" | "center" | "end";
      labels?: {
        boxWidth?: number;
        font?: {
          size?: number;
        };
      };
    };
    tooltip?: {
      callbacks?: {
        label?: (context: any) => string;
        title?: (context: any) => string;
      };
    };
  };
  scales?: {
    x?: {
      type?: "time" | "category" | "linear";
      time?: {
        unit: "hour" | "day" | "week";
        displayFormats: {
          hour: string;
          day: string;
          week: string;
          month?: string;
        };
      };
      stacked?: boolean;
      ticks?: {
        precision?: number;
        callback?: (value: any) => string;
      };
      title?: {
        display?: boolean;
        text?: string;
        font?: {
          size?: number;
          weight?: string;
        };
      };
      beginAtZero?: boolean;
      grid?: {
        display?: boolean;
        color?: string;
      };
    };
    y?: {
      beginAtZero?: boolean;
      stacked?: boolean;
      type?: "category" | "linear" | "logarithmic";
      ticks?: {
        precision?: number;
        callback?: (value: any) => string;
      };
      title?: {
        display?: boolean;
        text?: string;
        font?: {
          size?: number;
          weight?: string;
        };
      };
      grid?: {
        display?: boolean;
        color?: string;
        drawOnChartArea?: boolean;
      };
      position?: "left" | "right";
    };
    y1?: any;
    y2?: any;
  };
  cutout?: string;
}

/**
 * Simple time range with start and end dates
 */
export interface SimpleTimeRange {
  start: Date;
  end: Date;
}
