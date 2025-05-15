export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    tertiary: string;
    background: string;
    text: {
      primary: string;
      secondary: string;
    };
  };
  grid: {
    color: string;
  };
  text: {
    primary: string;
    secondary: string;
    font: {
      size: {
        small: number;
        medium: number;
        large: number;
      };
      weight: {
        normal: "normal";
        bold: "bold";
      };
    };
  };
}

export const theme: Theme = {
  colors: {
    primary: "#3366CC",
    secondary: "#DC3912",
    tertiary: "#FF9900",
    background: "#222222",
    text: {
      primary: "#FFFFFF",
      secondary: "rgba(255, 255, 255, 0.7)",
    },
  },
  grid: {
    color: "rgba(255, 255, 255, 0.2)",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "rgba(255, 255, 255, 0.7)",
    font: {
      size: {
        small: 14,
        medium: 16,
        large: 18,
      },
      weight: {
        normal: "normal",
        bold: "bold",
      },
    },
  },
};
