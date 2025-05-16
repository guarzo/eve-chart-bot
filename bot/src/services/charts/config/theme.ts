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

// Colorblind-safe palette with high contrast
const PALETTE = {
  // Primary colors
  blue: "#0072B2", // Strong blue
  red: "#D55E00", // Strong red
  green: "#009E73", // Strong green
  purple: "#CC79A7", // Strong purple
  orange: "#E69F00", // Strong orange
  yellow: "#F0E442", // Strong yellow

  // Secondary colors (darker variants)
  darkBlue: "#005B8F",
  darkRed: "#B34A00",
  darkGreen: "#007D5C",
  darkPurple: "#A9648C",
  darkOrange: "#BF8500",
  darkYellow: "#C8BC35",
};

export const theme: Theme = {
  colors: {
    primary: PALETTE.blue,
    secondary: PALETTE.red,
    tertiary: PALETTE.green,
    background: "#1A1A1A", // Dark background for better contrast
    text: {
      primary: "#FFFFFF",
      secondary: "rgba(255, 255, 255, 0.7)",
    },
  },
  grid: {
    color: "rgba(255, 255, 255, 0.15)", // Lighter grid for better visibility
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

// Export the palette for use in chart generators
export const chartPalette = Object.values(PALETTE);
