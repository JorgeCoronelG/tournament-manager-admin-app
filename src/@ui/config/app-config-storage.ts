import {
  AppColorScheme,
  AppConfig,
  AppConfigName,
} from "./app-config.interface";
import { CSSValue } from "../interfaces/css-value.type";

const STORAGE_KEY = "app.preferences.v1";

/**
 * The subset of the config that the user can change from the config panel.
 * Everything else (titles, sidenav options, ...) always comes from the code, so
 * changing a default does not get shadowed by stale stored values.
 */
export interface AppPreferences {
  id: AppConfigName;
  direction: AppConfig["direction"];
  style: {
    themeClassName: string;
    colorScheme: AppColorScheme;
    borderRadius: CSSValue;
    /** `null` means "inherit the layout's button radius" */
    buttonBorderRadius: CSSValue | null;
  };
  toolbarFixed: boolean;
  footer: { visible: boolean; fixed: boolean };
}

export function toPreferences(config: AppConfig): AppPreferences {
  return {
    id: config.id,
    direction: config.direction,
    style: {
      themeClassName: config.style.themeClassName,
      colorScheme: config.style.colorScheme,
      borderRadius: config.style.borderRadius,
      buttonBorderRadius: config.style.button.borderRadius ?? null,
    },
    toolbarFixed: config.toolbar.fixed,
    footer: { visible: config.footer.visible, fixed: config.footer.fixed },
  };
}

export function applyPreferences(
  base: AppConfig,
  preferences: AppPreferences,
): AppConfig {
  return {
    ...base,
    direction: preferences.direction,
    style: {
      ...base.style,
      themeClassName: preferences.style.themeClassName,
      colorScheme: preferences.style.colorScheme,
      borderRadius: preferences.style.borderRadius,
      button: {
        borderRadius: preferences.style.buttonBorderRadius ?? undefined,
      },
    },
    toolbar: { ...base.toolbar, fixed: preferences.toolbarFixed },
    footer: { ...base.footer, ...preferences.footer },
  };
}

export function readPreferences(
  validThemes: readonly string[],
): AppPreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;

    return isPreferences(value, validThemes) ? value : null;
  } catch {
    return null;
  }
}

export function writePreferences(preferences: AppPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable (private mode, quota): preferences just won't persist
  }
}

function isCssValue(value: unknown): value is CSSValue {
  const css = value as CSSValue | null;

  return !!css && typeof css.value === "number" && typeof css.unit === "string";
}

function isPreferences(
  value: unknown,
  validThemes: readonly string[],
): value is AppPreferences {
  const p = value as AppPreferences | null;

  return (
    !!p &&
    Object.values(AppConfigName).includes(p.id) &&
    (p.direction === "ltr" || p.direction === "rtl") &&
    !!p.style &&
    validThemes.includes(p.style.themeClassName) &&
    Object.values(AppColorScheme).includes(p.style.colorScheme) &&
    isCssValue(p.style.borderRadius) &&
    (p.style.buttonBorderRadius === null ||
      isCssValue(p.style.buttonBorderRadius)) &&
    typeof p.toolbarFixed === "boolean" &&
    !!p.footer &&
    typeof p.footer.visible === "boolean" &&
    typeof p.footer.fixed === "boolean"
  );
}
