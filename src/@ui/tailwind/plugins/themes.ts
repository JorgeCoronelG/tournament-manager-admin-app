import type { PluginAPI, PluginCreator } from "tailwindcss/plugin";
import type { Config } from "tailwindcss";
import { plugin } from "../utils/plugin";
import chroma from "chroma-js";
import { inheritDefaultTheme } from "../utils/inherit-default-theme";
import {
  createAngularMaterialComponentColorVariableName,
  createColorSchemeClassName,
  createColorVariableName,
  createThemeClassName,
} from "../utils/naming";
// noinspection ES6PreferShortImport
import { DeepPartial } from "../../interfaces/deep-partial.type";

type CSSRuleObject = Record<string, string>;

/** Tailwind 4 no longer passes the `e()` escape helper to plugins */
function escapeSelector(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

export interface AppThemeColorPalette {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;

  [shade: string]: string;
}

export interface AppThemeColorOptions {
  defaults: {
    lighter: keyof AppThemeColorPalette;
    default: keyof AppThemeColorPalette;
    darker: keyof AppThemeColorPalette;
  };
  palette: AppThemeColorPalette;
}

export interface AppThemeAngularMaterialColorForeground {
  base: string;
  divider: string;
  dividers: string;
  disabled: string;
  "disabled-button": string;
  "disabled-text": string;
  elevation: string;
  "hint-text": string;
  "secondary-text": string;
  icon: string;
  icons: string;
  text: string;
  "slider-min": string;
  "slider-off": string;
  "slider-off-active": string;
}

export interface AppThemeAngularMaterialColorBackground {
  "status-bar": string;
  "app-bar": string;
  background: string;
  hover: string;
  card: string;
  dialog: string;
  "disabled-button": string;
  "raised-button": string;
  "focused-button": string;
  "selected-button": string;
  "selected-disabled-button": string;
  "disabled-button-toggle": string;
  "unselected-chip": string;
  "disabled-list-option": string;
  tooltip: string;
}

export interface AppThemeOptions {
  colors: {
    primary: AppThemeColorOptions;
    "on-primary": Omit<AppThemeColorOptions, "defaults">;
    accent: AppThemeColorOptions;
    "on-accent": Omit<AppThemeColorOptions, "defaults">;
    warn: AppThemeColorOptions;
    "on-warn": Omit<AppThemeColorOptions, "defaults">;
  };
  angularMaterial: {
    colors: {
      light: {
        foreground: AppThemeAngularMaterialColorForeground;
        background: AppThemeAngularMaterialColorBackground;
      };
      dark: {
        foreground: AppThemeAngularMaterialColorForeground;
        background: AppThemeAngularMaterialColorBackground;
      };
    };
  };
}

export interface AppThemes {
  default: AppThemeOptions;

  [themeName: string]: DeepPartial<AppThemeOptions>;
}

export interface AppThemePluginOptions {
  themes: AppThemes;
}

export default plugin.withOptions(
  (options: AppThemePluginOptions): PluginCreator => {
    return ({ addComponents }: PluginAPI): void => {
      const themes = options.themes;

      for (const [themeName, partialThemeOptions] of Object.entries(themes)) {
        let themeOptions: AppThemeOptions;

        /**
         * Inherit default theme
         */
        if (themeName !== "default") {
          themeOptions = inheritDefaultTheme(
            partialThemeOptions,
            themes.default,
          );
        } else {
          themeOptions = partialThemeOptions as AppThemeOptions;
        }

        const themeComponents: CSSRuleObject = {};

        for (const [colorName, colorOptions] of Object.entries(
          themeOptions.colors,
        )) {
          for (const [colorShade, colorValue] of Object.entries(
            colorOptions.palette,
          )) {
            const colorVariableName = createColorVariableName(
              colorName,
              colorShade,
            );

            themeComponents[colorVariableName] = chroma(colorValue)
              .rgb()
              .join(" ");
          }

          /**
           * Expose the default/lighter/darker shades as `--app-color-<name>-<role>`.
           * `on-<name>` colors reuse the shades chosen for `<name>`.
           */
          const shadeSource = colorName.startsWith("on-")
            ? themeOptions.colors[
                colorName.slice(3) as keyof AppThemeOptions["colors"]
              ]
            : colorOptions;

          if ("defaults" in shadeSource) {
            for (const [role, shade] of Object.entries(shadeSource.defaults)) {
              themeComponents[createColorVariableName(colorName, role)] =
                chroma(colorOptions.palette[shade]).rgb().join(" ");
            }
          }
        }

        const themeClassName = createThemeClassName(escapeSelector(themeName));

        addComponents({
          [themeClassName]: themeComponents,
        });

        /**
         * Generate color schemes for Angular Material
         */
        for (const [colorSchemeName, colorSchemeOptions] of Object.entries(
          themeOptions.angularMaterial.colors,
        )) {
          const colorSchemeClassName = createColorSchemeClassName(
            colorSchemeName as "light" | "dark",
          );
          const angularMaterialColorSchemes: CSSRuleObject = {};

          for (const [
            colorSchemeSectionName,
            colorSchemeSectionOptions,
          ] of Object.entries(colorSchemeOptions)) {
            for (const [
              colorSchemeComponentName,
              colorSchemeComponentColor,
            ] of Object.entries(colorSchemeSectionOptions)) {
              const colorVariableName =
                createAngularMaterialComponentColorVariableName(
                  colorSchemeSectionName,
                  colorSchemeComponentName,
                );
              angularMaterialColorSchemes[colorVariableName] =
                colorSchemeComponentColor;
              angularMaterialColorSchemes[colorVariableName + "-rgb"] = chroma(
                colorSchemeComponentColor,
              )
                .rgb()
                .join(" ");
            }
          }

          addComponents({
            [`${themeClassName}${colorSchemeClassName}, ${themeClassName} ${colorSchemeClassName}`]:
              angularMaterialColorSchemes,
          });
        }
      }
    };
  },
  (options: AppThemePluginOptions): Partial<Config> => {
    const defaultTheme = options.themes.default;

    const colors: Record<string, AppThemeColorPalette> = {};

    for (const [colorName, colorOptions] of Object.entries(
      defaultTheme.colors,
    )) {
      colors[colorName] = {} as AppThemeColorPalette;

      for (const colorShade of Object.keys(colorOptions.palette)) {
        const colorVariableName = createColorVariableName(
          colorName,
          colorShade,
        );

        colors[colorName][colorShade] =
          `rgb(var(${colorVariableName}) / <alpha-value>)`;
      }
    }

    return {
      theme: {
        extend: {
          colors: colors,
        },
      },
    };
  },
);
