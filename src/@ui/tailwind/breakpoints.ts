/**
 * The single source of the app's breakpoints. Tailwind (`tailwind.config.ts`)
 * reads them for the `sm:`/`lg:` utilities and for `@variant`/`theme()` in
 * SCSS; TypeScript uses `mediaUp`/`mediaDown`. Change a value only here.
 */
export const screens = {
  sm: "600px",
  md: "960px",
  lg: "1280px",
  xl: "1440px",
} as const;

export type Screen = keyof typeof screens;

/** From `screen` upwards, like Tailwind's `sm:` */
export const mediaUp = (screen: Screen): string =>
  `(min-width: ${screens[screen]})`;

/** Below `screen`, like Tailwind's `max-sm:` (.02px short, for fractional widths) */
export const mediaDown = (screen: Screen): string =>
  `(max-width: ${parseFloat(screens[screen]) - 0.02}px)`;
