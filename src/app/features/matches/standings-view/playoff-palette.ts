import { StandingPlayoff } from "../match.model";

/**
 * Fixed colours of the playoffs, by priority: the main one always takes the first.
 * `bar` and `chip` follow the app's theme (600 light, 700 dark); `barLight` and `chipLight`
 * never change, for the exported image. Classes are written out so Tailwind finds them
 */
export const PLAYOFF_PALETTE = [
  {
    bar: "bg-indigo-600 dark:bg-indigo-700",
    chip: "bg-indigo-600/10 dark:bg-indigo-700/25",
    barLight: "bg-indigo-600",
    chipLight: "bg-indigo-100",
  },
  {
    bar: "bg-emerald-600 dark:bg-emerald-700",
    chip: "bg-emerald-600/10 dark:bg-emerald-700/25",
    barLight: "bg-emerald-600",
    chipLight: "bg-emerald-100",
  },
  {
    bar: "bg-fuchsia-600 dark:bg-fuchsia-700",
    chip: "bg-fuchsia-600/10 dark:bg-fuchsia-700/25",
    barLight: "bg-fuchsia-600",
    chipLight: "bg-fuchsia-100",
  },
  {
    bar: "bg-orange-600 dark:bg-orange-700",
    chip: "bg-orange-600/10 dark:bg-orange-700/25",
    barLight: "bg-orange-600",
    chipLight: "bg-orange-100",
  },
  {
    bar: "bg-cyan-600 dark:bg-cyan-700",
    chip: "bg-cyan-600/10 dark:bg-cyan-700/25",
    barLight: "bg-cyan-600",
    chipLight: "bg-cyan-100",
  },
  {
    bar: "bg-purple-600 dark:bg-purple-700",
    chip: "bg-purple-600/10 dark:bg-purple-700/25",
    barLight: "bg-purple-600",
    chipLight: "bg-purple-100",
  },
  {
    bar: "bg-teal-600 dark:bg-teal-700",
    chip: "bg-teal-600/10 dark:bg-teal-700/25",
    barLight: "bg-teal-600",
    chipLight: "bg-teal-100",
  },
  {
    bar: "bg-lime-600 dark:bg-lime-700",
    chip: "bg-lime-600/10 dark:bg-lime-700/25",
    barLight: "bg-lime-600",
    chipLight: "bg-lime-100",
  },
] as const;

export type PlayoffColor = (typeof PLAYOFF_PALETTE)[number];

/** The playoffs by priority with their colour: the same in every group and theme */
export function colorByPriority(
  playoffs: readonly StandingPlayoff[],
): Array<{ playoff: StandingPlayoff; color: PlayoffColor }> {
  return [...playoffs]
    .sort((a, b) => a.priority - b.priority)
    .map((playoff, index) => ({
      playoff,
      color: PLAYOFF_PALETTE[index % PLAYOFF_PALETTE.length],
    }));
}
