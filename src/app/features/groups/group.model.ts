import { RegistrationTeam } from "../registrations/registration.model";

export type GroupType = "regular_stage" | "playoff";

/** A team of a group: the registration's id and its team */
export interface GroupTeam {
  /** Registration id: the one assignments use */
  id: number;
  team: RegistrationTeam;
}

/** A slice of a regular group that feeds a playoff: positions `start` to `end` */
export type PlayoffSourceKind = "range" | "best_of_position";

export interface PlayoffSource {
  id: number;
  /** Absent in older answers: a range */
  kind?: PlayoffSourceKind;
  /** Null in a best-of-position source: it looks at every group */
  source_group_id: number | null;
  source_group_name: string | null;
  position_start: number;
  position_end: number;
  /** The position a best-of-position source compares (same as `position_start`) */
  position?: number | null;
  /** How many of the best teams in that position qualify */
  best_count?: number | null;
}

/** Matches a round is played over: one, or home and away */
export type RoundLegs = 1 | 2;

/** A round of a playoff as the backend names it, with the date (Y-m-d or null) of each of its matches */
export interface RoundDetail {
  name: string;
  legs: RoundLegs;
  dates: Array<string | null>;
}

/** A group as the list returns it; playoffs add dates, sources and rounds */
export interface Group {
  id: number;
  name: string;
  type: GroupType;
  teams_count: number;
  /** Y-m-d; playoffs only */
  start_date?: string | null;
  round_interval_days?: number;
  sources?: PlayoffSource[];
  total_teams?: number;
  rounds?: number;
  /** Y-m-d */
  final_date?: string | null;
  /** Y-m-d of each match, first round to the final; null when none was set by hand */
  round_dates?: Array<string | null> | null;
  /** Matches of each round, first round to the final */
  round_legs?: RoundLegs[];
  rounds_detail?: RoundDetail[];
  /** Playoffs only: false once the backend locks it; absent means editable */
  editable?: boolean;
}

export interface GroupsOverview {
  groups: Group[];
  unassigned: GroupTeam[];
  /** False when two or more playoffs end on different days */
  finals_aligned: boolean;
}

/** A regular group with its teams */
export interface RegularGroup extends Group {
  teams: GroupTeam[];
}

/** What the page shows: regular groups with their teams, playoffs and loose teams */
export interface GroupsView {
  regular: RegularGroup[];
  playoffs: Group[];
  unassigned: GroupTeam[];
  finalsAligned: boolean;
}

export type PlayoffSourceBody =
  | {
      source_group_id: number;
      position_start: number;
      position_end: number;
    }
  | {
      kind: "best_of_position";
      /** Same value in both: the position the best teams are compared in */
      position_start: number;
      position_end: number;
      best_count: number;
    };

/** Body of POST and PATCH /groups; a regular group only has a name */
export type GroupBody =
  | { name: string }
  | {
      name: string;
      type: "playoff";
      /** Y-m-d */
      start_date: string | null;
      round_interval_days: number;
      /** Y-m-d per match; only sent when the admin edited one by hand, null without a start date */
      round_dates?: string[] | null;
      /** Matches of each round, in the order of the rounds */
      round_legs?: RoundLegs[];
      sources: PlayoffSourceBody[];
    };

export interface GroupAssignment {
  registration_id: number;
  group_id: number | null;
}

export const DEFAULT_ROUND_INTERVAL_DAYS = 7;

/** Teams a playoff takes from its sources */
export function playoffTotal(
  sources: ReadonlyArray<{
    kind?: PlayoffSourceKind;
    position_start: number | null;
    position_end: number | null;
    best_count?: number | null;
  }>,
): number {
  return sources.reduce((total, source) => {
    const { position_start, position_end } = source;

    if (source.kind === "best_of_position") {
      const count = source.best_count ?? null;

      return count !== null && Number.isInteger(count) && count >= 1
        ? total + count
        : total;
    }

    if (
      position_start === null ||
      position_end === null ||
      !Number.isInteger(position_start) ||
      !Number.isInteger(position_end) ||
      position_start < 1 ||
      position_end < position_start
    ) {
      return total;
    }

    return total + position_end - position_start + 1;
  }, 0);
}

/** A playoff needs 2, 4, 8, 16, 32... teams */
export function isValidPlayoffTotal(total: number): boolean {
  return total >= 2 && (total & (total - 1)) === 0;
}

/** Teams that play each round, first round to the final: 8 → [8, 4, 2] */
export function playoffRounds(total: number): number[] {
  const rounds: number[] = [];

  for (let teams = total; isValidPlayoffTotal(teams); teams = teams / 2) {
    rounds.push(teams);
  }

  return rounds;
}

/** Translation key and params of a round's name, by the teams that play it */
export function roundLabel(teams: number): {
  key: string;
  params: { teams: number };
} {
  const known = [2, 4, 8, 16].includes(teams);

  return { key: `groups.round.${known ? teams : "other"}`, params: { teams } };
}

/** A date moved by whole days, in local time */
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * The date of each round counted from the first one: start, start + interval,
 * and so on. Without a start date, or with an invalid interval, the rounds
 * that depend on them have no date.
 */
export function autoRoundDates(
  start: Date | null,
  interval: number | null,
  count: number,
): Array<Date | null> {
  const valid =
    interval !== null && Number.isInteger(interval) && interval >= 1;

  return Array.from({ length: count }, (_, index) => {
    if (!start) {
      return null;
    }

    if (index === 0) {
      return start;
    }

    return valid ? addDays(start, interval * index) : null;
  });
}

/** True when every date that is set is later than the one before it */
export function datesInOrder(dates: ReadonlyArray<Date | null>): boolean {
  let previous: number | null = null;

  for (const date of dates) {
    if (!date) {
      continue;
    }

    const time = date.getTime();

    if (previous !== null && time <= previous) {
      return false;
    }

    previous = time;
  }

  return true;
}

/** Matches of a playoff: the sum of the matches of each round */
export function matchTotal(legs: readonly number[]): number {
  return legs.reduce((sum, value) => sum + value, 0);
}
