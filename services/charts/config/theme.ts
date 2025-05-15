import { COLORS } from "./common";

// Lighten a hex color by a percentage
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return `#${(
    (1 << 24) |
    ((R < 255 ? (R < 1 ? 0 : R) : 255) << 16) |
    ((G < 255 ? (G < 1 ? 0 : G) : 255) << 8) |
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  )
    .toString(16)
    .slice(1)}`;
}

// Dark mode color palette (20% lighter than base colors)
export const DARK_COLORS = COLORS.map((color) => lightenColor(color, 20));

// Theme configuration
export const theme = {
  light: {
    colors: COLORS,
    background: "#ffffff",
    text: "#666666",
    grid: "rgba(0, 0, 0, 0.1)",
    border: "rgba(0, 0, 0, 0.1)",
    tooltip: {
      background: "rgba(255, 255, 255, 0.9)",
      border: "rgba(0, 0, 0, 0.1)",
      text: "#666666",
    },
  },
  dark: {
    colors: DARK_COLORS,
    background: "#1a1a1a",
    text: "#ffffff",
    grid: "rgba(255, 255, 255, 0.1)",
    border: "rgba(255, 255, 255, 0.1)",
    tooltip: {
      background: "rgba(40, 40, 40, 0.9)",
      border: "rgba(255, 255, 255, 0.1)",
      text: "#ffffff",
    },
  },
};

// Current theme (can be changed at runtime)
let currentTheme = "light";

export function setTheme(themeName: "light" | "dark") {
  currentTheme = themeName;
}

export function getTheme() {
  return theme[currentTheme];
}

// Helper function to get current theme colors
export function getThemeColors() {
  return theme[currentTheme].colors;
}

// Helper function to get current theme settings
export function getThemeSettings() {
  return theme[currentTheme];
}
