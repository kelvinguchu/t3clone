// Type for model info with theme
export interface ModelInfo {
  theme: "blue" | "green" | "orange" | string;
}

export interface FloatingElementColors {
  primary: string;
  secondary: string;
}

// Get CSS classes for model-specific background themes
export function getModelThemeClasses(modelInfo: ModelInfo): string {
  switch (modelInfo.theme) {
    case "blue":
      return "from-blue-50/40 via-white to-cyan-50/40 dark:from-blue-950/20 dark:via-gray-950 dark:to-cyan-950/20";
    case "green":
      return "from-green-50/40 via-white to-emerald-50/40 dark:from-green-950/20 dark:via-gray-950 dark:to-emerald-950/20";
    case "orange":
      return "from-orange-50/40 via-white to-amber-50/40 dark:from-orange-950/20 dark:via-gray-950 dark:to-amber-950/20";
    default:
      return "from-blue-50/40 via-white to-cyan-50/40 dark:from-blue-950/20 dark:via-gray-950 dark:to-cyan-950/20";
  }
}

// Get color configuration for floating UI elements based on model theme
export function getFloatingElementColors(
  modelInfo: ModelInfo,
): FloatingElementColors {
  switch (modelInfo.theme) {
    case "blue":
      return {
        primary: "bg-blue-200/30 dark:bg-blue-800/20",
        secondary: "bg-cyan-200/30 dark:bg-cyan-800/20",
      };
    case "green":
      return {
        primary: "bg-green-200/30 dark:bg-green-800/20",
        secondary: "bg-emerald-200/30 dark:bg-emerald-800/20",
      };
    case "orange":
      return {
        primary: "bg-orange-200/30 dark:bg-orange-800/20",
        secondary: "bg-amber-200/30 dark:bg-amber-800/20",
      };
    default:
      return {
        primary: "bg-blue-200/30 dark:bg-blue-800/20",
        secondary: "bg-cyan-200/30 dark:bg-cyan-800/20",
      };
  }
}
