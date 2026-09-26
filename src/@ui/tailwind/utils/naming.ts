import { AppThemes } from "../plugins/themes";

export function createThemeClassName(themeName: keyof AppThemes): string {
  return `.app-theme-${themeName}`;
}

export function createColorSchemeClassName(
  colorScheme: "light" | "dark",
): string {
  return `.${colorScheme}`;
}

export function createColorVariableName(
  colorName: string,
  colorShade: string,
): string {
  return `--app-color-${colorName}-${colorShade}`;
}

export function createAngularMaterialComponentColorVariableName(
  sectionName: string,
  componentName: string,
): string {
  return `--app-${sectionName}-${componentName}`;
}
